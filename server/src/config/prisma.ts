import { PrismaClient } from '@prisma/client';
import { config } from './index';

let dbUrl = config.DATABASE_URL;
if (!dbUrl.includes('connection_limit')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=35&pool_timeout=20';
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production' || process.env.VERCEL === '1') {
  globalForPrisma.prisma = prisma;
}
