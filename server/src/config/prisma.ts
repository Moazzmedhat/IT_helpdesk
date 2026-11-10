import { PrismaClient } from '@prisma/client';
import { config } from './index';

let dbUrl = config.DATABASE_URL;
if (!dbUrl.includes('connection_limit')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=35&pool_timeout=20';
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});
