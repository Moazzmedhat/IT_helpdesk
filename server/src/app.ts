import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { csrfTokenGenerator, csrfProtection } from './middleware/csrf.middleware';
import { optionalAuthenticate } from './middleware/auth.middleware';
import { authRouter } from './modules/auth/auth.routes';
import { ticketRouter } from './modules/tickets/ticket.routes';
import { commentRouter } from './modules/comments/comment.routes';
import { attachmentRouter } from './modules/attachments/attachment.routes';
import { notificationRouter } from './modules/notifications/notification.routes';
import { reportRouter } from './modules/reports/report.routes';
import { adminRouter } from './modules/admin/admin.routes';

export function createApp(): Express {
  const app = express();

  // Trust proxy headers from Vercel / reverse proxies
  app.set('trust proxy', 1);

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
      }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));

  // CORS: Support local dev, configured CLIENT_URL, and Vercel deployment domains
  const isAllowedOrigin = (origin?: string): boolean => {
    if (!origin) return true; // Same-origin, serverless internal, curl, Postman
    if (origin === config.CLIENT_URL) return true;
    if (origin.endsWith('.vercel.app')) return true;
    if (process.env.VERCEL_URL && origin.includes(process.env.VERCEL_URL)) return true;
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL && origin.includes(process.env.VERCEL_PROJECT_PRODUCTION_URL)) return true;
    if (config.NODE_ENV !== 'production') return true;
    return false;
  };

  app.use(cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With']
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(config.SESSION_SECRET));

  // CSRF token generation & validation
  app.use(csrfTokenGenerator);
  app.use(csrfProtection);

  // Optional authentication on all routes to populate req.user if session cookie is present
  app.use(optionalAuthenticate);

  // API Routes (support both /api/... and direct /... for Vercel service rewrites)
  app.use('/api/auth', authRouter);
  app.use('/auth', authRouter);
  app.use('/api/tickets/:ticketId/comments', commentRouter);
  app.use('/tickets/:ticketId/comments', commentRouter);
  app.use('/api/tickets/:ticketId/attachments', attachmentRouter);
  app.use('/tickets/:ticketId/attachments', attachmentRouter);
  app.use('/api/attachments', attachmentRouter);
  app.use('/attachments', attachmentRouter);
  app.use('/api/tickets', ticketRouter);
  app.use('/tickets', ticketRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/notifications', notificationRouter);
  app.use('/api/reports', reportRouter);
  app.use('/reports', reportRouter);
  app.use('/api/admin', adminRouter);
  app.use('/admin', adminRouter);

  // Health Check Endpoints
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      authMode: config.AUTH_MODE
    });
  });

  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      authMode: config.AUTH_MODE
    });
  });

  // Base API ping
  app.get('/api/ping', (req: Request, res: Response) => {
    res.status(200).json({ message: 'IT Helpdesk API active' });
  });

  // Global Error Handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Application Error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: config.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    });
  });

  return app;
}
