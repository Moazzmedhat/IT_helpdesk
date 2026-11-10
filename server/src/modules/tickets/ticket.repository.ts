import { Prisma, PrismaClient, Ticket, TicketStatus, PriorityLevel, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface CreateTicketData {
  ticketNumber: string;
  title: string;
  description: string;
  requesterId: string;
  departmentId: string;
  branchId: string;
  categoryId: string;
  subcategoryId?: string | null;
  priority: PriorityLevel;
  deviceAssetTag?: string | null;
}

export interface TicketFilterOptions {
  requesterId?: string;
  assignedToId?: string;
  status?: TicketStatus | TicketStatus[];
  priority?: PriorityLevel;
  departmentId?: string;
  branchId?: string;
  categoryId?: string;
  search?: string;
  queueTab?: 'available' | 'in_progress' | 'pending' | 'resolved' | 'closed' | 'my_tickets';
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'priority' | 'status' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export class TicketRepository {
  async findById(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.ticket.findUnique({
      where: { id },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
        department: true,
        branch: true,
        category: true,
        subcategory: true,
        history: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
      },
    });
  }

  async findByTicketNumber(ticketNumber: string) {
    return prisma.ticket.findUnique({
      where: { ticketNumber },
      include: {
        requester: true,
        assignedTo: true,
        department: true,
        branch: true,
        category: true,
        subcategory: true,
      },
    });
  }

  async create(data: CreateTicketData, tx: Prisma.TransactionClient) {
    return tx.ticket.create({
      data: {
        ticketNumber: data.ticketNumber,
        title: data.title,
        description: data.description,
        requesterId: data.requesterId,
        departmentId: data.departmentId,
        branchId: data.branchId,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId || null,
        priority: data.priority,
        deviceAssetTag: data.deviceAssetTag || null,
        status: TicketStatus.OPEN,
        version: 1,
      },
      include: {
        requester: { select: { id: true, fullName: true, email: true, role: true } },
        department: true,
        branch: true,
        category: true,
        subcategory: true,
      },
    });
  }

  /**
   * Executes atomic claim update:
   * UPDATE "Ticket" SET "assignedToId" = $1, "status" = 'IN_PROGRESS', "claimedAt" = NOW(), "version" = "version" + 1, "updatedAt" = NOW()
   * WHERE "id" = $2 AND "assignedToId" IS NULL AND "status" IN ('OPEN', 'REOPENED')
   */
  async executeAtomicClaim(
    ticketId: string,
    technicianId: string,
    tx: Prisma.TransactionClient
  ): Promise<number> {
    const affected = await tx.$executeRaw`
      UPDATE "Ticket"
      SET "assignedToId" = ${technicianId},
          "status" = 'IN_PROGRESS'::"TicketStatus",
          "claimedAt" = NOW(),
          "version" = "version" + 1,
          "updatedAt" = NOW()
      WHERE "id" = ${ticketId}
        AND "assignedToId" IS NULL
        AND "status" IN ('OPEN'::"TicketStatus", 'REOPENED'::"TicketStatus");
    `;

    return affected;
  }

  async updateStatusWithHistory(
    params: {
      ticketId: string;
      fromStatus: TicketStatus;
      toStatus: TicketStatus;
      actorId: string;
      reason?: string | null;
      assignedToId?: string | null; // For release, set to null
      resolvedAt?: Date | null;
      closedAt?: Date | null;
    },
    tx: Prisma.TransactionClient
  ) {
    const updateData: Prisma.TicketUpdateInput = {
      status: params.toStatus,
      version: { increment: 1 },
      updatedAt: new Date(),
    };

    if (params.assignedToId !== undefined) {
      updateData.assignedTo = params.assignedToId ? { connect: { id: params.assignedToId } } : { disconnect: true };
    }

    if (params.resolvedAt !== undefined) {
      updateData.resolvedAt = params.resolvedAt;
    }

    if (params.closedAt !== undefined) {
      updateData.closedAt = params.closedAt;
    }

    const updatedTicket = await tx.ticket.update({
      where: { id: params.ticketId },
      data: updateData,
    });

    await tx.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorId: params.actorId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        reason: params.reason || null,
      },
    });

    return updatedTicket;
  }

  async listTickets(options: TicketFilterOptions) {
    const where: Prisma.TicketWhereInput = {};

    if (options.requesterId) {
      where.requesterId = options.requesterId;
    }

    if (options.assignedToId) {
      where.assignedToId = options.assignedToId;
    }

    if (options.status) {
      if (Array.isArray(options.status)) {
        where.status = { in: options.status };
      } else {
        where.status = options.status;
      }
    }

    if (options.priority) {
      where.priority = options.priority;
    }

    if (options.departmentId) {
      where.departmentId = options.departmentId;
    }

    if (options.branchId) {
      where.branchId = options.branchId;
    }

    if (options.categoryId) {
      where.categoryId = options.categoryId;
    }

    if (options.queueTab) {
      switch (options.queueTab) {
        case 'available':
          where.status = { in: [TicketStatus.OPEN, TicketStatus.REOPENED] };
          where.assignedToId = null;
          break;
        case 'in_progress':
          where.status = TicketStatus.IN_PROGRESS;
          break;
        case 'pending':
          where.status = TicketStatus.PENDING;
          break;
        case 'resolved':
          where.status = TicketStatus.RESOLVED;
          break;
        case 'closed':
          where.status = TicketStatus.CLOSED;
          break;
      }
    }

    if (options.search) {
      const term = options.search.trim();
      where.OR = [
        { ticketNumber: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { deviceAssetTag: { contains: term, mode: 'insensitive' } },
      ];
    }

    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: options.limit || 20,
        skip: options.offset || 0,
        include: {
          requester: { select: { id: true, fullName: true, email: true, role: true } },
          assignedTo: { select: { id: true, fullName: true, email: true, role: true } },
          department: true,
          branch: true,
          category: true,
          subcategory: true,
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return { tickets, total };
  }
}

export const ticketRepository = new TicketRepository();
