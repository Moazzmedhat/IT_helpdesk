import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { config } from '../../config';
import { sessionService, SESSION_COOKIE_NAME } from './session.service';
import { auditService } from '../audit/audit.service';
import { getAuthProvider } from './auth-provider.interface';
import { CSRF_COOKIE_NAME } from '../../middleware/csrf.middleware';

const devLoginSchema = z.object({
  email: z.string().email(),
});

export class AuthController {
  async getMe(req: Request, res: Response) {
    if (!req.user) {
      return res.status(200).json({ authenticated: false, user: null });
    }

    const csrfToken = req.cookies[CSRF_COOKIE_NAME] || (req as any).csrfToken;

    res.status(200).json({
      authenticated: true,
      csrfToken,
      user: {
        id: req.user.id,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role,
        department: req.user.department ? { id: req.user.department.id, name: req.user.department.name, code: req.user.department.code } : null,
        branch: req.user.branch ? { id: req.user.branch.id, name: req.user.branch.name, code: req.user.branch.code, city: req.user.branch.city } : null,
      },
    });
  }

  async getDevUsers(req: Request, res: Response) {
    if (config.AUTH_MODE !== 'dev' || config.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Forbidden', message: 'Dev auth is disabled' });
    }

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        department: { select: { name: true, code: true } },
        branch: { select: { name: true, code: true } },
      },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });

    res.status(200).json({ users });
  }

  async devLogin(req: Request, res: Response) {
    if (config.AUTH_MODE !== 'dev' || config.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Forbidden', message: 'Dev auth is disabled' });
    }

    const parseResult = devLoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid email address' });
    }

    const { email } = parseResult.data;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { department: true, branch: true },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found or inactive' });
    }

    const session = await sessionService.createSession(
      user.id,
      req.ip,
      req.headers['user-agent']
    );

    res.cookie(SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });

    await auditService.log({
      actorId: user.id,
      action: 'LOGIN',
      entity: 'Session',
      entityId: session.id,
      details: { authMode: 'dev', email: user.email, role: user.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const csrfToken = req.cookies[CSRF_COOKIE_NAME] || (req as any).csrfToken;

    res.status(200).json({
      success: true,
      csrfToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department ? { id: user.department.id, name: user.department.name, code: user.department.code } : null,
        branch: user.branch ? { id: user.branch.id, name: user.branch.name, code: user.branch.code, city: user.branch.city } : null,
      },
    });
  }

  async oidcLogin(req: Request, res: Response) {
    if (config.AUTH_MODE !== 'oidc') {
      return res.status(400).json({ error: 'Bad Request', message: 'OIDC auth is not active' });
    }

    const authProvider = getAuthProvider();
    const state = Buffer.from(JSON.stringify({ nonce: Date.now() })).toString('base64url');
    const codeChallenge = 'mock-or-real-pkce-challenge';
    const authUrl = await authProvider.getAuthorizationUrl(state, codeChallenge);
    res.redirect(authUrl);
  }

  async logout(req: Request, res: Response) {
    const sessionId = req.cookies[SESSION_COOKIE_NAME];
    if (sessionId) {
      await sessionService.revokeSession(sessionId);
      if (req.user) {
        await auditService.log({
          actorId: req.user.id,
          action: 'LOGOUT',
          entity: 'Session',
          entityId: sessionId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }
    }

    res.clearCookie(SESSION_COOKIE_NAME);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  }
}

export const authController = new AuthController();
