import { Prisma, PriorityLevel, Role, TicketStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ticketRepository, TicketFilterOptions } from './ticket.repository';
import { ticketNumberService } from './ticket-number.service';
import { validateSafeContent } from './sensitive-data-guard';
import { auditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../middleware/auth.middleware';
import { socketService } from '../notifications/socket.service';

export class ConflictError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class TicketService {
  /**
   * Create a new ticket (Employees only)
   */
  async createTicket(
    data: {
      title: string;
      description: string;
      departmentId?: string;
      branchId?: string;
      categoryId: string;
      subcategoryId?: string | null;
      priority?: PriorityLevel;
      deviceAssetTag?: string | null;
    },
    user: AuthenticatedUser
  ) {
    // Only EMPLOYEE role can create tickets
    if (user.role !== Role.EMPLOYEE) {
      throw new ForbiddenError('Only employees can create technical support tickets');
    }

    // Sensitive data inspection
    const titleCheck = validateSafeContent(data.title);
    if (!titleCheck.isSafe) {
      throw new BadRequestError(titleCheck.reason!);
    }
    const descCheck = validateSafeContent(data.description);
    if (!descCheck.isSafe) {
      throw new BadRequestError(descCheck.reason!);
    }

    // Default department and branch to user's own if not provided
    const departmentId = data.departmentId || user.departmentId;
    const branchId = data.branchId || user.branchId;

    if (!departmentId || !branchId) {
      throw new BadRequestError('Department and Branch are required for ticket submission');
    }

    const priority = data.priority || PriorityLevel.MEDIUM;

    // Transaction for atomic ticket number generation and creation
    const ticket = await prisma.$transaction(async (tx) => {
      const ticketNumber = await ticketNumberService.generateNextNumber(tx);

      const created = await ticketRepository.create(
        {
          ticketNumber,
          title: data.title,
          description: data.description,
          requesterId: user.id,
          departmentId,
          branchId,
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId || null,
          priority,
          deviceAssetTag: data.deviceAssetTag || null,
        },
        tx
      );

      // Create initial history record
      await tx.ticketHistory.create({
        data: {
          ticketId: created.id,
          actorId: user.id,
          fromStatus: TicketStatus.OPEN,
          toStatus: TicketStatus.OPEN,
          reason: 'Ticket created',
        },
      });

      return created;
    });

    await auditService.log({
      actorId: user.id,
      action: 'TICKET_CREATE',
      entity: 'Ticket',
      entityId: ticket.id,
      details: { ticketNumber: ticket.ticketNumber, priority: ticket.priority },
    });

    socketService.emitTicketCreated(ticket).catch(() => {});

    return ticket;
  }

  /**
   * Get ticket details with role-based access control
   */
  async getTicketById(id: string, user: AuthenticatedUser) {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Employee isolation: Employees can only view their own tickets
    if (user.role === Role.EMPLOYEE && ticket.requesterId !== user.id) {
      throw new NotFoundError('Ticket not found');
    }

    return ticket;
  }

  /**
   * List tickets with role-based queue separation
   */
  async listTickets(options: TicketFilterOptions, user: AuthenticatedUser) {
    const filter: TicketFilterOptions = { ...options };

    // Employee isolation: enforce own tickets only
    if (user.role === Role.EMPLOYEE) {
      filter.requesterId = user.id;
    }

    return ticketRepository.listTickets(filter);
  }

  /**
   * Atomic claim of an OPEN or REOPENED ticket by an active technician
   */
  async claimTicket(ticketId: string, user: AuthenticatedUser) {
    if (user.role !== Role.TECHNICIAN) {
      throw new ForbiddenError('Only technicians can claim tickets');
    }

    return prisma.$transaction(
      async (tx) => {
        // 1. Execute conditional atomic update directly
        const affected = await ticketRepository.executeAtomicClaim(ticketId, user.id, tx);
        if (affected === 0) {
          throw new ConflictError('Ticket already claimed by another technician');
        }

        // 2. Write TicketHistory record in the same transaction
        await tx.ticketHistory.create({
          data: {
            ticketId,
            actorId: user.id,
            fromStatus: TicketStatus.OPEN,
            toStatus: TicketStatus.IN_PROGRESS,
            reason: 'Claimed by technician',
          },
        });

        // 3. Return updated ticket
        return ticketRepository.findById(ticketId, tx);
      },
      { timeout: 15000, maxWait: 10000 }
    ).then(async (updated) => {
      // Audit log asynchronously after transaction commits
      await auditService.log({
        actorId: user.id,
        action: 'CLAIM',
        entity: 'Ticket',
        entityId: ticketId,
        details: { technicianEmail: user.email },
      });
      if (updated) {
        socketService.emitTicketClaimed(updated, user).catch(() => {});
      }
      return updated;
    });
  }

  /**
   * Release ticket back to OPEN (owner technician or admin with mandatory reason)
   */
  async releaseTicket(ticketId: string, reason: string, user: AuthenticatedUser) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestError('A reason is required to release a ticket');
    }

    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new NotFoundError('Ticket not found');
      }

      // Authorization check
      if (user.role === Role.TECHNICIAN) {
        if (ticket.assignedToId !== user.id) {
          throw new ForbiddenError('You can only release tickets you currently own');
        }
      } else if (user.role !== Role.ADMIN) {
        throw new ForbiddenError('Not authorized to release tickets');
      }

      // Allowed statuses for release: IN_PROGRESS or PENDING
      if (ticket.status !== TicketStatus.IN_PROGRESS && ticket.status !== TicketStatus.PENDING) {
        throw new ConflictError(`Cannot release ticket from status ${ticket.status}`);
      }

      const updated = await ticketRepository.updateStatusWithHistory(
        {
          ticketId,
          fromStatus: ticket.status,
          toStatus: TicketStatus.OPEN,
          actorId: user.id,
          reason: `Released: ${reason.trim()}`,
          assignedToId: null,
        },
        tx
      );

      await auditService.log({
        actorId: user.id,
        action: 'RELEASE',
        entity: 'Ticket',
        entityId: ticketId,
        details: { reason, previousStatus: ticket.status, previousOwner: ticket.assignedToId },
      });

      socketService.emitStatusChanged(updated, ticket.status, TicketStatus.OPEN, user).catch(() => {});

      return updated;
    });
  }

  /**
   * Transition ticket status
   */
  async transitionStatus(
    ticketId: string,
    toStatus: TicketStatus,
    reason: string | undefined,
    user: AuthenticatedUser
  ) {
    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new NotFoundError('Ticket not found');
      }

      const fromStatus = ticket.status;

      // Closed is terminal for non-admin
      if (fromStatus === TicketStatus.CLOSED) {
        throw new ConflictError('Closed tickets cannot transition to any other status');
      }

      // Admin override capability
      if (user.role === Role.ADMIN) {
        const updated = await ticketRepository.updateStatusWithHistory(
          {
            ticketId,
            fromStatus,
            toStatus,
            actorId: user.id,
            reason: reason || 'Admin forced transition',
            resolvedAt: toStatus === TicketStatus.RESOLVED ? new Date() : undefined,
            closedAt: toStatus === TicketStatus.CLOSED ? new Date() : undefined,
          },
          tx
        );

        await auditService.log({
          actorId: user.id,
          action: 'ADMIN_OVERRIDE',
          entity: 'Ticket',
          entityId: ticketId,
          details: { fromStatus, toStatus, reason },
        });

        socketService.emitStatusChanged(updated, fromStatus, toStatus, user).catch(() => {});

        return updated;
      }

      // Business rules for Employee
      if (user.role === Role.EMPLOYEE) {
        if (ticket.requesterId !== user.id) {
          throw new NotFoundError('Ticket not found');
        }

        if (fromStatus === TicketStatus.RESOLVED && toStatus === TicketStatus.CLOSED) {
          // Employee confirms resolution
          const updated = await ticketRepository.updateStatusWithHistory(
            {
              ticketId,
              fromStatus,
              toStatus,
              actorId: user.id,
              reason: reason || 'Resolution confirmed by requester',
              closedAt: new Date(),
            },
            tx
          );
          socketService.emitStatusChanged(updated, fromStatus, toStatus, user).catch(() => {});
          return updated;
        }

        if (fromStatus === TicketStatus.RESOLVED && toStatus === TicketStatus.REOPENED) {
          // Check reopen window
          const reopenSetting = await tx.setting.findUnique({ where: { key: 'DEFAULT_REOPEN_WINDOW_DAYS' } });
          const windowDays = reopenSetting ? parseInt(reopenSetting.value, 10) : 7;
          const resolvedDate = ticket.resolvedAt || ticket.updatedAt;
          const maxReopenDate = new Date(resolvedDate.getTime() + windowDays * 24 * 60 * 60 * 1000);

          if (new Date() > maxReopenDate) {
            throw new ConflictError(`Reopen window (${windowDays} days) has expired for this ticket`);
          }

          const updated = await ticketRepository.updateStatusWithHistory(
            {
              ticketId,
              fromStatus,
              toStatus,
              actorId: user.id,
              reason: reason || 'Reopened by requester',
              assignedToId: null, // Clear assignee so it returns to available queue
            },
            tx
          );
          socketService.emitStatusChanged(updated, fromStatus, toStatus, user).catch(() => {});
          return updated;
        }

        throw new ConflictError(`Employees cannot perform transition from ${fromStatus} to ${toStatus}`);
      }

      // Business rules for Technician
      if (user.role === Role.TECHNICIAN) {
        if (ticket.assignedToId !== user.id) {
          throw new ForbiddenError('You can only update status on tickets you own');
        }

        // Allowed transitions for owner:
        // IN_PROGRESS <-> PENDING
        // IN_PROGRESS -> RESOLVED
        const validTransition =
          (fromStatus === TicketStatus.IN_PROGRESS && toStatus === TicketStatus.PENDING) ||
          (fromStatus === TicketStatus.PENDING && toStatus === TicketStatus.IN_PROGRESS) ||
          (fromStatus === TicketStatus.IN_PROGRESS && toStatus === TicketStatus.RESOLVED);

        if (!validTransition) {
          throw new ConflictError(`Transition from ${fromStatus} to ${toStatus} is not allowed`);
        }

        const updated = await ticketRepository.updateStatusWithHistory(
          {
            ticketId,
            fromStatus,
            toStatus,
            actorId: user.id,
            reason: reason || null,
            resolvedAt: toStatus === TicketStatus.RESOLVED ? new Date() : undefined,
          },
          tx
        );

        await auditService.log({
          actorId: user.id,
          action: 'STATUS_CHANGE',
          entity: 'Ticket',
          entityId: ticketId,
          details: { fromStatus, toStatus, reason },
        });

        socketService.emitStatusChanged(updated, fromStatus, toStatus, user).catch(() => {});

        return updated;
      }

      throw new ConflictError(`Unauthorized transition from ${fromStatus} to ${toStatus}`);
    });
  }

  /**
   * Reassign ticket (Admin only)
   */
  async reassignTicket(ticketId: string, newTechnicianId: string, reason: string, user: AuthenticatedUser) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError('Only admins can reassign tickets');
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestError('Reason is required for ticket reassignment');
    }

    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) throw new NotFoundError('Ticket not found');

      const tech = await tx.user.findUnique({ where: { id: newTechnicianId } });
      if (!tech || tech.role !== Role.TECHNICIAN || !tech.isActive) {
        throw new BadRequestError('Target user is not an active technician');
      }

      const prevOwner = ticket.assignedToId;

      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          assignedToId: newTechnicianId,
          status: TicketStatus.IN_PROGRESS,
          version: { increment: 1 },
        },
      });

      await tx.ticketHistory.create({
        data: {
          ticketId,
          actorId: user.id,
          fromStatus: ticket.status,
          toStatus: TicketStatus.IN_PROGRESS,
          reason: `Admin reassigned to ${tech.fullName}: ${reason}`,
        },
      });

      await auditService.log({
        actorId: user.id,
        action: 'ADMIN_REASSIGN',
        entity: 'Ticket',
        entityId: ticketId,
        details: { previousOwner: prevOwner, newOwner: newTechnicianId, reason },
      });

      return updated;
    });
  }
}

export const ticketService = new TicketService();
