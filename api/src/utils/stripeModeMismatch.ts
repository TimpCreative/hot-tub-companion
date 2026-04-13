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
