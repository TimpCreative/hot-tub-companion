import { env } from '../config/environment';

/** Ensure API URL is absolute (required for img src, etc.) */
function getAbsoluteApiBase(): string {
  let base = (env.API_URL || '').trim().replace(/\/+$/, '');
  if (!base) return 'http://localhost:3000';
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/a47da7ba-8944-40d5-a7b1-3ca8dd181a2c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97b103'},body:JSON.stringify({sessionId:'97b103',location:'mediaUrl.ts:getAbsoluteApiBase',message:'API base used for media URLs',data:{apiUrl:env.API_URL,resolved:base},hypothesisId:'H4',timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return base;
}

/** Build proxy URL for a storage path */
export function buildProxyUrl(storagePath: string): string {
  const apiBase = getAbsoluteApiBase();
  return `${apiBase}/api/v1/media/serve?path=${encodeURIComponent(storagePath)}`;
}

/** Build proxy URL by media file ID - more reliable (looks up path from DB) */
export function buildProxyUrlById(mediaFileId: string): string {
  const apiBase = getAbsoluteApiBase();
  return `${apiBase}/api/v1/media/serve/${mediaFileId}`;
}

/** Convert Firebase/GCS URL to our proxy URL for backwards compatibility */
export function toProxyUrl(existingUrl: string | null): string | null {
  if (!existingUrl?.trim()) return existingUrl;

  const url = existingUrl.trim();
  const apiBase = getAbsoluteApiBase();

  if (url.includes('/api/v1/media/serve')) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const idMatch = url.match(/\/serve\/([a-f0-9-]+)(?:\?|$)/i);
    if (idMatch) return `${apiBase}/api/v1/media/serve/${idMatch[1]}`;
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
