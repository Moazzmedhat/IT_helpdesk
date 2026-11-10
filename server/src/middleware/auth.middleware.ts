import { Request, Response, NextFunction } from 'express';
import { Role, User, Department, Branch } from '@prisma/client';
import { sessionService, SESSION_COOKIE_NAME } from '../modules/auth/session.service';

export type AuthenticatedUser = User & {
  department?: Department | null;
  branch?: Branch | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionId?: string;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  if (req.user) {
    return next();
  }

  const sessionId = req.cookies[SESSION_COOKIE_NAME];
  if (!sessionId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }

  const user = await sessionService.validateAndTouchSession(sessionId);
  if (!user) {
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session' });
  }

  req.user = user;
  req.sessionId = sessionId;
  next();
}

export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies[SESSION_COOKIE_NAME];
  if (!sessionId) {
    return next();
  }

  sessionService.validateAndTouchSession(sessionId)
    .then(user => {
      if (user) {
        req.user = user;
        req.sessionId = sessionId;
      }
      next();
    })
    .catch(() => next());
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role ${req.user.role} does not have access to this resource`
      });
    }

    next();
  };
}
