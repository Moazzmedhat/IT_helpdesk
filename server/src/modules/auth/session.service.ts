import crypto from 'crypto';
import { prisma } from '../../config/prisma';

export const SESSION_COOKIE_NAME = 'helpdesk_session';
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours

interface CachedSession {
  user: any;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  cachedAt: number;
}

// In-memory session cache to avoid repeated DB roundtrips on rapid concurrent requests
const sessionMemoryCache = new Map<string, CachedSession>();
const CACHE_TTL_MS = 15000; // 15 seconds

export class SessionService {
  async createSession(userId: string, ipAddress?: string, userAgent?: string) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS);

    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        expiresAt,
        absoluteExpiresAt,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return session;
  }

  async validateAndTouchSession(sessionId: string) {
    if (!sessionId) return null;

    const now = new Date();
    const nowTime = now.getTime();

    // Check fast in-memory cache
    const cached = sessionMemoryCache.get(sessionId);
    if (cached && (nowTime - cached.cachedAt) < CACHE_TTL_MS) {
      if (now > cached.expiresAt || now > cached.absoluteExpiresAt || !cached.user.isActive) {
        sessionMemoryCache.delete(sessionId);
        await this.revokeSession(sessionId);
        return null;
      }
      return cached.user;
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            department: true,
            branch: true,
          },
        },
      },
    });

    if (!session) {
      sessionMemoryCache.delete(sessionId);
      return null;
    }

    // Check idle timeout
    if (now > session.expiresAt) {
      sessionMemoryCache.delete(sessionId);
      await this.revokeSession(sessionId);
      return null;
    }

    // Check absolute timeout
    if (now > session.absoluteExpiresAt) {
      sessionMemoryCache.delete(sessionId);
      await this.revokeSession(sessionId);
      return null;
    }

    // Check if user is active
    if (!session.user.isActive) {
      sessionMemoryCache.delete(sessionId);
      await this.revokeSession(sessionId);
      return null;
    }

    // Touch idle expiry only if more than 60 seconds elapsed since expiresAt was set
    const remainingIdle = session.expiresAt.getTime() - nowTime;
    if (remainingIdle < (IDLE_TIMEOUT_MS - 60000)) {
      const newExpiresAt = new Date(nowTime + IDLE_TIMEOUT_MS);
      const finalExpiresAt = newExpiresAt > session.absoluteExpiresAt ? session.absoluteExpiresAt : newExpiresAt;

      // Update in background without blocking response
      prisma.session.update({
        where: { id: sessionId },
        data: { expiresAt: finalExpiresAt },
      }).catch(() => {});
    }

    // Store in in-memory cache
    sessionMemoryCache.set(sessionId, {
      user: session.user,
      expiresAt: session.expiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
      cachedAt: nowTime,
    });

    return session.user;
  }

  async revokeSession(sessionId: string) {
    sessionMemoryCache.delete(sessionId);
    try {
      await prisma.session.delete({
        where: { id: sessionId },
      });
    } catch {
      // Ignored if already deleted
    }
  }

  async revokeAllUserSessions(userId: string) {
    sessionMemoryCache.clear();
    await prisma.session.deleteMany({
      where: { userId },
    });
  }
}

export const sessionService = new SessionService();
