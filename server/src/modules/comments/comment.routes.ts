import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { commentController } from './comment.controller';
import { authenticate } from '../../middleware/auth.middleware';

const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too Many Requests', message: 'Comment rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post('/', commentLimiter, commentController.addComment);
router.get('/', commentController.getComments);

export const commentRouter = router;
