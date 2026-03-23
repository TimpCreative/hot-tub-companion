/**
 * Normalize errors from axios + our API interceptor (rejects response.data or raw axios error).
 */
function messageFromHtmlBody(body: string): string | null {
  const pre = body.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (pre?.[1]) {
    return pre[1].trim();
  }
  if (body.includes('<!DOCTYPE') || body.includes('<html')) {
    return 'Server returned an HTML error page (is the API running the latest code?)';
  }
  return null;
}

export function getApiErrorMessage(err: unknown): string {
  if (err === null || err === undefined) {
    return 'Something went wrong';
  }
  if (typeof err === 'string') {
    const fromHtml = messageFromHtmlBody(err);
    if (fromHtml) return fromHtml;
    return err;
  }
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.length > 0) {
      return o.message;
    }
    const apiErr = o.error;
    if (apiErr && typeof apiErr === 'object') {
      const msg = (apiErr as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.length > 0) {
        return msg;
      }
      const code = (apiErr as { code?: unknown }).code;
      if (typeof code === 'string' && code.length > 0) {
        return code;
      }
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Something went wrong';
}
