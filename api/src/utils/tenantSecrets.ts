import crypto from 'crypto';
import { env } from '../config/environment';

const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const raw = env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error('ENCRYPTION_KEY is required to store or read encrypted tenant secrets');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

export function isEncryptedTenantSecret(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX);
}

export function encryptTenantSecret(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isEncryptedTenantSecret(trimmed)) return trimmed;

  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptTenantSecret(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isEncryptedTenantSecret(trimmed)) return trimmed;

  const payload = trimmed.slice(PREFIX.length);
  const [ivB64, tagB64, encryptedB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Invalid encrypted tenant secret format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');
  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
