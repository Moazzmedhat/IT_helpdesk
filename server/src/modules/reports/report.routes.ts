import { Router, Request, Response, NextFunction } from 'express';
import { reportService } from './report.service';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate, requireRole(Role.ADMIN));

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getDashboardMetrics();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export const reportRouter = router;
