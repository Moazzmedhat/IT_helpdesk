import { CommentVisibility, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { validateSafeContent } from '../tickets/sensitive-data-guard';
import { BadRequestError, ForbiddenError, NotFoundError } from '../tickets/ticket.service';
import { AuthenticatedUser } from '../../middleware/auth.middleware';
import { auditService } from '../audit/audit.service';
import { socketService } from '../notifications/socket.service';

export class CommentService {
  async addComment(
    params: {
      ticketId: string;
      content: string;
      visibility?: CommentVisibility;
    },
    user: AuthenticatedUser
  ) {
    const { ticketId, content } = params;
    const visibility = params.visibility || CommentVisibility.PUBLIC;

    // 1. Validate sensitive content guard
    const check = validateSafeContent(content);
    if (!check.isSafe) {
      throw new BadRequestError(check.reason!);
    }

    // 2. Verify ticket existence & access
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, requesterId: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // 3. Permission checks
    if (user.role === Role.EMPLOYEE) {
      // Employees can only comment on own tickets
      if (ticket.requesterId !== user.id) {
        throw new NotFoundError('Ticket not found');
      }
      // Employees can never create internal notes
      if (visibility === CommentVisibility.INTERNAL) {
        throw new ForbiddenError('Employees cannot create internal notes');
      }
    }

    // 4. Create comment in database
    const comment = await prisma.comment.create({
      data: {
        ticketId,
        authorId: user.id,
        content: content.trim(),
        visibility,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        attachments: true,
      },
    });

    await auditService.log({
      actorId: user.id,
      action: visibility === CommentVisibility.INTERNAL ? 'ADD_INTERNAL_NOTE' : 'ADD_COMMENT',
      entity: 'Ticket',
      entityId: ticketId,
      details: { commentId: comment.id, visibility },
    });

    socketService.emitCommentAdded(ticket, comment).catch(() => {});

    return comment;
  }

  async getCommentsByTicketId(ticketId: string, user: AuthenticatedUser) {
    // 1. Verify ticket access
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, requesterId: true },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    if (user.role === Role.EMPLOYEE && ticket.requesterId !== user.id) {
      throw new NotFoundError('Ticket not found');
    }

    // 2. Build where filter: STRICT ISOLATION FOR INTERNAL NOTES
    const where: any = { ticketId };
    if (user.role === Role.EMPLOYEE) {
      // Employees ONLY see PUBLIC comments
      where.visibility = CommentVisibility.PUBLIC;
    }

    const comments = await prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        attachments: true,
      },
    });

    return comments;
  }
}

export const commentService = new CommentService();
