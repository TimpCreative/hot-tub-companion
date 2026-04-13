import test from 'node:test';
import assert from 'node:assert/strict';
import { responseForStripeCheckoutModeMismatch } from '../utils/stripeModeMismatch';

test('detects test key + live price Stripe message', () => {
  const err = new Error(
    "No such price: 'price_xxx'; a similar object exists in live mode, but a test mode key was used to make this request."
  );
  const r = responseForStripeCheckoutModeMismatch(err);
  assert.ok(r);
  assert.equal(r?.code, 'STRIPE_MODE_MISMATCH');
  assert.equal(r?.status, 400);
});

test('returns null for unrelated errors', () => {
  assert.equal(responseForStripeCheckoutModeMismatch(new Error('No such price')), null);
});
