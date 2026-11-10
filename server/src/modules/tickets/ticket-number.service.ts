import { Prisma, PrismaClient } from '@prisma/client';

export class TicketNumberService {
  /**
   * Generates a race-safe ticket number: IT-YYYY-NNNNN
   * Uses an atomic upsert/increment on the YearSequence row inside the transaction.
   */
  async generateNextNumber(tx: Prisma.TransactionClient): Promise<string> {
    const currentYear = new Date().getFullYear();

    // Use raw atomic query or upsert to increment the year sequence counter
    const result = await tx.$queryRaw<Array<{ next_val: number }>>`
      INSERT INTO "YearSequence" ("year", "lastNumber", "updatedAt")
      VALUES (${currentYear}, 1, NOW())
      ON CONFLICT ("year")
      DO UPDATE SET "lastNumber" = "YearSequence"."lastNumber" + 1, "updatedAt" = NOW()
      RETURNING "lastNumber" AS next_val;
    `;

    const nextVal = result[0]?.next_val ?? 1;
    const padded = String(nextVal).padStart(5, '0');
    return `IT-${currentYear}-${padded}`;
  }
}

export const ticketNumberService = new TicketNumberService();
