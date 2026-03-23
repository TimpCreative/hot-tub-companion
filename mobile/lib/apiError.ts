/**
 * Normalize errors from axios + our API interceptor (rejects response.data or raw axios error).
 */
export function getApiErrorMessage(err: unknown): string {
  if (err === null || err === undefined) {
    return 'Something went wrong';
  }
  if (typeof err === 'string') {
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
