import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { attachmentController } from './attachment.controller';
import { authenticate } from '../../middleware/auth.middleware';

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too Many Requests', message: 'Attachment upload rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const router = Router({ mergeParams: true });

// Local download route
router.get('/download/:key', attachmentController.downloadLocalFile);

// Protected routes
router.use(authenticate);

router.post('/upload', uploadLimiter, upload.single('file'), attachmentController.uploadAttachment);
router.get('/:id/url', attachmentController.getDownloadUrl);

export const attachmentRouter = router;
