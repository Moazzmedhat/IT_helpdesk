import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Role } from '@prisma/client';
import { authController } from './auth.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.get('/me', authController.getMe);
router.get('/dev-users', authLimiter, authController.getDevUsers);
router.post('/dev-login', authLimiter, authController.devLogin);
router.get('/login', authLimiter, authController.oidcLogin);
router.post('/logout', authController.logout);

// Role verification test endpoints
router.get('/test-employee', authenticate, requireRole(Role.EMPLOYEE), (req: Request, res: Response) => {
  res.json({ success: true, message: 'Welcome Employee' });
});

router.get('/test-tech', authenticate, requireRole(Role.TECHNICIAN), (req: Request, res: Response) => {
  res.json({ success: true, message: 'Welcome Technician' });
});

router.get('/test-admin', authenticate, requireRole(Role.ADMIN), (req: Request, res: Response) => {
  res.json({ success: true, message: 'Welcome Admin' });
});

export const authRouter = router;
