import { TicketStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { auditService } from '../modules/audit/audit.service';

export class AutoCloseJob {
  async runAutoClose() {
    const autoCloseSetting = await prisma.setting.findUnique({
      where: { key: 'DEFAULT_AUTO_CLOSE_DAYS' },
    });
    const days = autoCloseSetting ? parseInt(autoCloseSetting.value, 10) : 3;
    const thresholdDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Find all RESOLVED tickets resolved prior to the threshold
    const candidates = await prisma.ticket.findMany({
      where: {
        status: TicketStatus.RESOLVED,
        resolvedAt: { lte: thresholdDate },
      },
      select: { id: true, ticketNumber: true, status: true },
    });

    let closedCount = 0;
    for (const ticket of candidates) {
      await prisma.$transaction(async (tx) => {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.CLOSED,
            closedAt: new Date(),
            version: { increment: 1 },
          },
        });

        await tx.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            actorId: (await tx.user.findFirst({ where: { role: 'ADMIN' } }))?.id || '',
            fromStatus: TicketStatus.RESOLVED,
            toStatus: TicketStatus.CLOSED,
            reason: `Auto-closed by system after ${days} days in resolved state`,
          },
        });
      });

      await auditService.log({
        action: 'AUTO_CLOSE',
        entity: 'Ticket',
        entityId: ticket.id,
        details: { ticketNumber: ticket.ticketNumber, daysThreshold: days },
      });

      closedCount++;
    }

    return { candidatesFound: candidates.length, closedCount };
  }
}

export const autoCloseJob = new AutoCloseJob();
