import { PrismaClient } from '@prisma/client';
import { config } from './index';

let dbUrl = config.DATABASE_URL;
if (!dbUrl.includes('connection_limit')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=35&pool_timeout=20';
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let prismaInstance: PrismaClient;

try {
  prismaInstance =
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
    globalForPrisma.prisma = prismaInstance;
  }
} catch (e) {
  console.error('CRITICAL: Failed to instantiate PrismaClient:', e);
  prismaInstance = new Proxy({} as PrismaClient, {
    get(target, prop) {
      return () => Promise.reject(new Error(`PrismaClient failed to initialize: ${(e as Error)?.message || e}`));
    },
  });
}

export const prisma = prismaInstance;
