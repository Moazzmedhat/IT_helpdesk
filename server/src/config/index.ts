import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  CLIENT_URL: z.string().default('http://localhost:4200'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/helpdesk?schema=public'),
  AUTH_MODE: z.enum(['dev', 'oidc']).default('dev'),
  SESSION_SECRET: z.string().min(16).default('it-helpdesk-session-secret-key-32-chars-long'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z.string().transform(v => v === 'true').default('false'),

  // OIDC
  OIDC_ISSUER_URL: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_REDIRECT_URI: z.string().optional(),
  OIDC_SCOPES: z.string().default('openid profile email'),

  // Storage S3 / MinIO
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('helpdesk-attachments'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_FORCE_PATH_STYLE: z.string().transform(v => v === 'true').default('true'),

  // App defaults
  DEFAULT_AUTO_CLOSE_DAYS: z.string().transform(Number).default('3'),
  DEFAULT_REOPEN_WINDOW_DAYS: z.string().transform(Number).default('7'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  throw new Error('Environment configuration error');
}

export const config = parsed.data;

// Security check: Refuse to start with AUTH_MODE=dev in production
if (config.NODE_ENV === 'production' && config.AUTH_MODE === 'dev') {
  throw new Error('FATAL SECURITY ERROR: AUTH_MODE=dev is not allowed in production!');
}
