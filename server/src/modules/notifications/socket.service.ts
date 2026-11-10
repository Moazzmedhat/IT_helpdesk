import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { sessionService, SESSION_COOKIE_NAME } from '../auth/session.service';
import { AuthenticatedUser } from '../../middleware/auth.middleware';
import { config } from '../../config';
import { Role, CommentVisibility } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { emailNotifier } from './email-notifier.interface';

function parseCookie(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {};
  cookieHeader.split(';').forEach((item) => {
    const parts = item.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('=').trim());
    }
  });
  return list;
}

export class SocketService {
  private io: Server | null = null;

  init(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.CLIENT_URL,
        credentials: true,
      },
    });

    // Authenticated handshake middleware
    this.io.use(async (socket: Socket, next) => {
      try {
        const rawCookies = socket.handshake.headers.cookie;
        if (!rawCookies) {
          return next(new Error('Authentication required'));
        }

        const parsedCookies = parseCookie(rawCookies);
        const sessionId = parsedCookies[SESSION_COOKIE_NAME];
        if (!sessionId) {
          return next(new Error('Session cookie not found'));
        }

        const user = await sessionService.validateAndTouchSession(sessionId);
        if (!user) {
          return next(new Error('Invalid or expired session'));
        }

        (socket as any).user = user;
        next();
      } catch (err: any) {
        next(new Error(`Authentication failed: ${err.message}`));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = (socket as any).user as AuthenticatedUser;
      if (!user) return;

      // Join per-user room
      socket.join(`user:${user.id}`);

      // Join per-role room
      socket.join(`role:${user.role}`);

      socket.on('disconnect', () => {
        // Leave rooms automatically
      });
    });

    return this.io;
  }

  getIO(): Server | null {
    return this.io;
  }

  async emitTicketCreated(ticket: any) {
    if (!this.io) return;

    const payload = {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
    };

    // Broadcast to all technicians and admins
    this.io.to('role:TECHNICIAN').to('role:ADMIN').emit('ticket:created', payload);
    // Send to requester
    this.io.to(`user:${ticket.requesterId}`).emit('ticket:created', payload);

    // Persist notification for technicians
    await this.createNotification({
      title: 'New Ticket Submitted',
      message: `Ticket ${ticket.ticketNumber}: ${ticket.title}`,
      ticketId: ticket.id,
      role: Role.TECHNICIAN,
    });
  }

  async emitTicketClaimed(ticket: any, technician: any) {
    if (!this.io) return;

    const payload = {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      assignedTo: {
        id: technician.id,
        fullName: technician.fullName,
      },
      claimedAt: ticket.claimedAt,
    };

    // Technicians see ticket claimed -> remove from Available list
    this.io.to('role:TECHNICIAN').to('role:ADMIN').emit('ticket:claimed', payload);
    // Requester gets notified
    this.io.to(`user:${ticket.requesterId}`).emit('ticket:claimed', payload);

    await this.createNotification({
      userId: ticket.requesterId,
      title: 'Ticket Claimed',
      message: `Your ticket ${ticket.ticketNumber} is now being worked on by ${technician.fullName}.`,
      ticketId: ticket.id,
    });
  }

  async emitStatusChanged(ticket: any, fromStatus: string, toStatus: string, actor: any) {
    if (!this.io) return;

    const payload = {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      fromStatus,
      toStatus,
      actor: { id: actor.id, fullName: actor.fullName },
      updatedAt: ticket.updatedAt,
    };

    this.io.to('role:TECHNICIAN').to('role:ADMIN').emit('ticket:status_changed', payload);
    this.io.to(`user:${ticket.requesterId}`).emit('ticket:status_changed', payload);

    await this.createNotification({
      userId: ticket.requesterId,
      title: `Ticket Status Updated: ${toStatus}`,
      message: `Ticket ${ticket.ticketNumber} changed to ${toStatus} by ${actor.fullName}.`,
      ticketId: ticket.id,
    });
  }

  async emitCommentAdded(ticket: any, comment: any) {
    if (!this.io) return;

    const payload = {
      id: comment.id,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      author: { id: comment.author.id, fullName: comment.author.fullName, role: comment.author.role },
      visibility: comment.visibility,
      createdAt: comment.createdAt,
    };

    if (comment.visibility === CommentVisibility.PUBLIC) {
      // Public comment sent to technicians, admins and the ticket creator
      this.io.to('role:TECHNICIAN').to('role:ADMIN').emit('comment:added', payload);
      this.io.to(`user:${ticket.requesterId}`).emit('comment:added', payload);

      if (comment.author.id !== ticket.requesterId) {
        await this.createNotification({
          userId: ticket.requesterId,
          title: `New Comment on ${ticket.ticketNumber}`,
          message: `${comment.author.fullName} replied to your ticket.`,
          ticketId: ticket.id,
        });
      }
    } else {
      // INTERNAL NOTE: Strictly restricted to staff only! NEVER sent to employee room!
      this.io.to('role:TECHNICIAN').to('role:ADMIN').emit('comment:added', payload);
    }
  }

  private async createNotification(data: {
    userId?: string;
    role?: Role;
    title: string;
    message: string;
    ticketId?: string;
  }) {
    try {
      if (data.userId) {
        await prisma.notification.create({
          data: {
            userId: data.userId,
            title: data.title,
            message: data.message,
            ticketId: data.ticketId || null,
          },
        });
      } else if (data.role) {
        const users = await prisma.user.findMany({
          where: { role: data.role, isActive: true },
          select: { id: true, email: true },
        });

        if (users.length > 0) {
          await prisma.notification.createMany({
            data: users.map((u) => ({
              userId: u.id,
              title: data.title,
              message: data.message,
              ticketId: data.ticketId || null,
            })),
          });
        }
      }
    } catch (e) {
      console.error('Failed to persist notification:', e);
    }
  }
}

export const socketService = new SocketService();
