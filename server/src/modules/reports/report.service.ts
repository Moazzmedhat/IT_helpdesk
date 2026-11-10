import { Prisma, PriorityLevel, Role, TicketStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

export class ReportService {
  async getDashboardMetrics() {
    const [
      byStatus,
      byPriority,
      byCategory,
      byDepartment,
      byBranch,
      technicianWorkload,
      settings,
    ] = await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.ticket.groupBy({ by: ['priority'], _count: { id: true } }),
      prisma.ticket.groupBy({ by: ['categoryId'], _count: { id: true } }),
      prisma.ticket.groupBy({ by: ['departmentId'], _count: { id: true } }),
      prisma.ticket.groupBy({ by: ['branchId'], _count: { id: true } }),
      prisma.ticket.groupBy({
        by: ['assignedToId'],
        where: { assignedToId: { not: null }, status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } },
        _count: { id: true },
      }),
      prisma.setting.findMany(),
    ]);

    // Fetch names for categories, departments, branches, technicians
    const [categories, departments, branches, technicians] = await Promise.all([
      prisma.category.findMany({ select: { id: true, name: true } }),
      prisma.department.findMany({ select: { id: true, name: true, code: true } }),
      prisma.branch.findMany({ select: { id: true, name: true, code: true } }),
      prisma.user.findMany({
        where: { role: Role.TECHNICIAN },
        select: { id: true, fullName: true, email: true },
      }),
    ]);

    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const deptMap = new Map(departments.map((d) => [d.id, `${d.name} (${d.code})`]));
    const branchMap = new Map(branches.map((b) => [b.id, `${b.name} (${b.code})`]));
    const techMap = new Map(technicians.map((t) => [t.id, t.fullName]));

    // Resolution time calculation (hours)
    const resolvedTickets = await prisma.ticket.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, claimedAt: true, resolvedAt: true },
    });

    let totalResolutionHours = 0;
    for (const t of resolvedTickets) {
      if (t.resolvedAt) {
        const start = t.claimedAt || t.createdAt;
        const diffMs = t.resolvedAt.getTime() - start.getTime();
        totalResolutionHours += diffMs / (1000 * 60 * 60);
      }
    }
    const avgResolutionHours = resolvedTickets.length > 0 ? +(totalResolutionHours / resolvedTickets.length).toFixed(1) : 0;

    // First response time calculation (first public comment by technician)
    const ticketsWithComments = await prisma.ticket.findMany({
      select: {
        id: true,
        createdAt: true,
        comments: {
          where: {
            visibility: 'PUBLIC',
            author: { role: Role.TECHNICIAN },
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    let totalFirstResponseHours = 0;
    let respondedTicketsCount = 0;
    for (const t of ticketsWithComments) {
      if (t.comments.length > 0) {
        respondedTicketsCount++;
        const diffMs = t.comments[0].createdAt.getTime() - t.createdAt.getTime();
        totalFirstResponseHours += diffMs / (1000 * 60 * 60);
      }
    }
    const avgFirstResponseHours = respondedTicketsCount > 0 ? +(totalFirstResponseHours / respondedTicketsCount).toFixed(1) : 0;

    // Overdue tickets calculation based on configurable SLA settings
    const settingsMap = new Map(settings.map((s) => [s.key, parseInt(s.value, 10)]));
    const slaHours: Record<PriorityLevel, number> = {
      [PriorityLevel.CRITICAL]: settingsMap.get('SLA_OVERDUE_CRITICAL_HOURS') || 2,
      [PriorityLevel.HIGH]: settingsMap.get('SLA_OVERDUE_HIGH_HOURS') || 8,
      [PriorityLevel.MEDIUM]: settingsMap.get('SLA_OVERDUE_MEDIUM_HOURS') || 24,
      [PriorityLevel.LOW]: settingsMap.get('SLA_OVERDUE_LOW_HOURS') || 72,
    };

    const openTickets = await prisma.ticket.findMany({
      where: {
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.PENDING, TicketStatus.REOPENED] },
      },
      select: { id: true, ticketNumber: true, title: true, priority: true, createdAt: true, status: true },
    });

    const now = new Date();
    const overdueTickets = openTickets.filter((t) => {
      const allowedHours = slaHours[t.priority] || 24;
      const ageHours = (now.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
      return ageHours > allowedHours;
    });

    return {
      summary: {
        totalTickets: await prisma.ticket.count(),
        openTickets: openTickets.length,
        resolvedTickets: resolvedTickets.length,
        overdueCount: overdueTickets.length,
        avgResolutionHours,
        avgFirstResponseHours,
      },
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count.id })),
      byCategory: byCategory.map((c) => ({ categoryId: c.categoryId, name: catMap.get(c.categoryId) || 'Unknown', count: c._count.id })),
      byDepartment: byDepartment.map((d) => ({ departmentId: d.departmentId, name: deptMap.get(d.departmentId) || 'Unknown', count: d._count.id })),
      byBranch: byBranch.map((b) => ({ branchId: b.branchId, name: branchMap.get(b.branchId) || 'Unknown', count: b._count.id })),
      technicianPerformance: technicianWorkload.map((tw) => ({
        technicianId: tw.assignedToId,
        name: tw.assignedToId ? techMap.get(tw.assignedToId) || 'Unassigned' : 'Unassigned',
        resolvedCount: tw._count.id,
      })),
      overdueTickets,
    };
  }
}

export const reportService = new ReportService();
