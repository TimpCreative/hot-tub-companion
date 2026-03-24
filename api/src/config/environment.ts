import dotenv from 'dotenv';

dotenv.config();

const required = [
  'DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'JWT_SECRET',
] as const;

export function validateEnv(): void {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Set them in Railway.`);
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  API_URL: process.env.API_URL || 'http://localhost:3000',
  DATABASE_URL: process.env.DATABASE_URL!,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID!,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL!,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'noreply@hottubcompanion.com',
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME || 'Hot Tub Companion',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  SUPER_ADMIN_EMAILS: (process.env.SUPER_ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean),
  /** Emails allowed to log in to any tenant app as admin (whitelist override when no users row) */
  TENANT_ADMIN_EMAILS: (process.env.TENANT_ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean),
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  /** Secret for cron dispatch endpoint; min 32 chars. Required when cron is used. */
  CRON_SECRET: process.env.CRON_SECRET,
};
