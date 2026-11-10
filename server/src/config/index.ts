import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

function clean(v?: string): string | undefined {
  if (!v) return undefined;
  return v.trim().replace(/^["']|["']$/g, '').trim();
}

const cleanedEnv: Record<string, any> = { ...process.env };
for (const [k, v] of Object.entries(cleanedEnv)) {
  if (typeof v === 'string') {
    cleanedEnv[k] = clean(v);
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.any().transform(v => {
    const num = Number(v);
    return isNaN(num) || num <= 0 ? 3000 : num;
  }).default(3000),
  CLIENT_URL: z.string().default(
    clean(process.env.CLIENT_URL) ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${clean(process.env.VERCEL_PROJECT_PRODUCTION_URL)}` :
      (process.env.VERCEL_URL ? `https://${clean(process.env.VERCEL_URL)}` : 'http://localhost:4200'))
  ),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/helpdesk?schema=public'),
  AUTH_MODE: z.string().transform(v => clean(v)?.toLowerCase() === 'oidc' ? 'oidc' : 'dev').default('dev'),
  SESSION_SECRET: z.string().default('it-helpdesk-session-secret-key-32-chars-long'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z.any().transform(v => {
    if (v === 'true' || v === true) return true;
    if (v === 'false' || v === false) return false;
    return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  }).default(false),

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
  S3_FORCE_PATH_STYLE: z.any().transform(v => v === 'true' || v === true).default(true),

  // App defaults
  DEFAULT_AUTO_CLOSE_DAYS: z.any().transform(v => Number(v) || 3).default(3),
  DEFAULT_REOPEN_WINDOW_DAYS: z.any().transform(v => Number(v) || 7).default(7),
});

const parsed = envSchema.safeParse(cleanedEnv);

if (!parsed.success) {
  console.warn('⚠️ Environment warning, using safe fallbacks:', parsed.error.format());
}

export const config = parsed.success
  ? parsed.data
  : {
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      PORT: 3000,
      CLIENT_URL: clean(process.env.CLIENT_URL) || 'http://localhost:4200',
      DATABASE_URL: clean(process.env.DATABASE_URL) || 'postgresql://postgres:postgres@localhost:5432/helpdesk?schema=public',
      AUTH_MODE: (clean(process.env.AUTH_MODE)?.toLowerCase() === 'oidc' ? 'oidc' : 'dev') as 'dev' | 'oidc',
      SESSION_SECRET: clean(process.env.SESSION_SECRET) || 'it-helpdesk-session-secret-key-32-chars-long',
      COOKIE_DOMAIN: clean(process.env.COOKIE_DOMAIN) || 'localhost',
      COOKIE_SECURE: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
      OIDC_ISSUER_URL: clean(process.env.OIDC_ISSUER_URL) as string | undefined,
      OIDC_CLIENT_ID: clean(process.env.OIDC_CLIENT_ID) as string | undefined,
      OIDC_CLIENT_SECRET: clean(process.env.OIDC_CLIENT_SECRET) as string | undefined,
      OIDC_REDIRECT_URI: clean(process.env.OIDC_REDIRECT_URI) as string | undefined,
      OIDC_SCOPES: 'openid profile email',
      S3_ENDPOINT: clean(process.env.S3_ENDPOINT) as string | undefined,
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'helpdesk-attachments',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin',
      S3_FORCE_PATH_STYLE: true,
      DEFAULT_AUTO_CLOSE_DAYS: 3,
      DEFAULT_REOPEN_WINDOW_DAYS: 7,
    };
