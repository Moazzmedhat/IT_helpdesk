import { prisma } from '../../config/prisma';

export interface CreateAuditLogParams {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  async log(params: CreateAuditLogParams) {
    try {
      return await prisma.auditLog.create({
        data: {
          actorId: params.actorId || null,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId || null,
          details: params.details ? (params.details as any) : undefined,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Append-only audit logger should never crash the main operation, but we ensure error is logged
      return null;
    }
  }

  async query(options: {
    actorId?: string;
    action?: string;
    entity?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (options.actorId) where.actorId = options.actorId;
    if (options.action) where.action = options.action;
    if (options.entity) where.entity = options.entity;
    if (options.entityId) where.entityId = options.entityId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}

export const auditService = new AuditService();
