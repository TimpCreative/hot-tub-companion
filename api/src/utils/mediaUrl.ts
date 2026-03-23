import { env } from '../config/environment';

/** Build proxy URL for a storage path */
export function buildProxyUrl(storagePath: string): string {
  const apiBase = (env.API_URL || '').replace(/\/+$/, '');
  return `${apiBase}/api/v1/media/serve?path=${encodeURIComponent(storagePath)}`;
}

/** Convert Firebase/GCS URL to our proxy URL for backwards compatibility */
export function toProxyUrl(existingUrl: string | null): string | null {
  if (!existingUrl?.trim()) return existingUrl;

  const url = existingUrl.trim();
  const apiBase = (env.API_URL || '').replace(/\/+$/, '');

  if (url.includes('/api/v1/media/serve')) return url;

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
