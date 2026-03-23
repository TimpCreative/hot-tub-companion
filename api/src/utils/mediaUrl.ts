import { env } from '../config/environment';

/** Ensure API URL is absolute (required for img src, etc.) */
function getAbsoluteApiBase(): string {
  let base = (env.API_URL || '').trim().replace(/\/+$/, '');
  if (!base) return 'http://localhost:3000';
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base;
}

/** Build proxy URL for a storage path */
export function buildProxyUrl(storagePath: string): string {
  const apiBase = getAbsoluteApiBase();
  return `${apiBase}/api/v1/media/serve?path=${encodeURIComponent(storagePath)}`;
}

/** Convert Firebase/GCS URL to our proxy URL for backwards compatibility */
export function toProxyUrl(existingUrl: string | null): string | null {
  if (!existingUrl?.trim()) return existingUrl;

  const url = existingUrl.trim();
  const apiBase = getAbsoluteApiBase();

  if (url.includes('/api/v1/media/serve')) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const q = url.includes('?') ? url.substring(url.indexOf('?')) : '';
    return `${apiBase}/api/v1/media/serve${q}`;
  }

  const fbMatch = url.match(/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/);
  if (fbMatch) {
    try {
      const decoded = decodeURIComponent(fbMatch[1]);
      if (decoded.startsWith('uhtd/') && !decoded.includes('..')) {
        return `${apiBase}/api/v1/media/serve?path=${encodeURIComponent(decoded)}`;
      }
    } catch {
      /* ignore */
    }
  }

  const gcsMatch = url.match(/storage\.googleapis\.com\/[^/]+\/(.+?)(?:\?|$)/);
  if (gcsMatch) {
    try {
      const decoded = decodeURIComponent(gcsMatch[1]);
      if (decoded.startsWith('uhtd/') && !decoded.includes('..')) {
        return `${apiBase}/api/v1/media/serve?path=${encodeURIComponent(decoded)}`;
      }
    } catch {
      /* ignore */
    }
  }

  return url;
}
