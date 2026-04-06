/**
 * Shared retry for Shopify HTTP 429 / 5xx (Admin REST, Storefront GraphQL).
 * Does not log tokens or secrets.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ShopifyRetryContext = {
  /** For structured logs only */
  tenantId: string;
  /** Short label e.g. GET /products.json */
  label: string;
};

/**
 * Retries the same request on 429 or 5xx with exponential backoff + jitter.
 * Honors Retry-After when present (seconds).
 */
export async function fetchWithShopifyTransientRetry(
  ctx: ShopifyRetryContext,
  execute: () => Promise<Response>,
  maxAttempts = 5
): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await execute();
    last = res;
    const retryable = res.status === 429 || (res.status >= 500 && res.status <= 599);
    if (!retryable || attempt === maxAttempts) {
      return res;
    }
    const retryAfter = res.headers.get('Retry-After');
    let waitMs = Math.min(8000, 400 * 2 ** (attempt - 1)) + Math.random() * 250;
    if (retryAfter) {
      const sec = parseInt(retryAfter, 10);
      if (!Number.isNaN(sec) && sec >= 0) {
        waitMs = Math.min(30000, sec * 1000);
      }
    }
    console.warn(
      `[shopifyHttp] tenant=${ctx.tenantId} ${ctx.label} status=${res.status} retry ${attempt}/${maxAttempts} in ${Math.round(waitMs)}ms`
    );
    await sleep(waitMs);
  }
  return last as Response;
}
