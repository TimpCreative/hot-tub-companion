import Stripe from 'stripe';

const MAX_CLIENT_MESSAGE_LEN = 420;

/**
 * Stripe rejects Checkout when platform key mode (sk_test vs sk_live) does not match
 * Price / Account objects. Detect that case and return a clear API error instead of a generic 500.
 */
export function responseForStripeCheckoutModeMismatch(err: unknown): {
  code: 'STRIPE_MODE_MISMATCH';
  message: string;
  status: 400;
} | null {
  if (!err || typeof err !== 'object') return null;
  const msg = String((err as { message?: string }).message || '');
  if (
    /test mode key was used to make this request/i.test(msg) ||
    /live mode key was used to make this request/i.test(msg) ||
    /similar object exists in live mode.*test mode/i.test(msg) ||
    /similar object exists in test mode.*live mode/i.test(msg)
  ) {
    return {
      code: 'STRIPE_MODE_MISMATCH',
      message:
        'Stripe test/live mismatch: STRIPE_SECRET_KEY must match the mode of saved subscription prices. Use sk_test with prices created in test mode, or sk_live with live prices. After changing keys, recreate prices in Retail Admin (toggle subscription eligibility or subscription offer).',
      status: 400,
    };
  }
  return null;
}

/**
 * Map Stripe errors from checkout session creation to HTTP responses so deploy logs + clients
 * get actionable messages instead of a generic 500.
 */
export function cartCheckoutResponseFromStripeError(err: unknown): {
  code: string;
  message: string;
  status: number;
} | null {
  const mode = responseForStripeCheckoutModeMismatch(err);
  if (mode) {
    return { code: mode.code, message: mode.message, status: mode.status };
  }

  if (err instanceof Stripe.errors.StripeInvalidRequestError) {
    const raw = err.message || 'Stripe rejected this checkout';
    const safe =
      raw.length > MAX_CLIENT_MESSAGE_LEN ? raw.slice(0, MAX_CLIENT_MESSAGE_LEN) + '…' : raw;
    return {
      code: 'STRIPE_CHECKOUT_INVALID',
      message: safe,
      status: 400,
    };
  }

  if (
    err instanceof Stripe.errors.StripeConnectionError ||
    err instanceof Stripe.errors.StripeAPIError
  ) {
    return {
      code: 'STRIPE_UNAVAILABLE',
      message: 'Payment provider is temporarily unavailable. Try again shortly.',
      status: 503,
    };
  }

  return null;
}
