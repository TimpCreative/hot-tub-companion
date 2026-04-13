import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {
  responseForStripeCheckoutModeMismatch,
  cartCheckoutResponseFromStripeError,
} from '../utils/stripeSubscriptionCheckoutErrors';

test('detects test key + live price Stripe message', () => {
  const err = new Error(
    "No such price: 'price_xxx'; a similar object exists in live mode, but a test mode key was used to make this request."
  );
  const r = responseForStripeCheckoutModeMismatch(err);
  assert.ok(r);
  assert.equal(r?.code, 'STRIPE_MODE_MISMATCH');
  assert.equal(r?.status, 400);
});

test('returns null for unrelated plain errors (mode helper)', () => {
  assert.equal(responseForStripeCheckoutModeMismatch(new Error('No such price')), null);
});

test('maps StripeInvalidRequestError to STRIPE_CHECKOUT_INVALID', () => {
  const err = new Stripe.errors.StripeInvalidRequestError({
    message: 'Invalid URL: An HTTPS URL must be specified',
    type: 'invalid_request_error',
    param: 'success_url',
  } as Stripe.StripeRawError);
  const r = cartCheckoutResponseFromStripeError(err);
  assert.ok(r);
  assert.equal(r?.code, 'STRIPE_CHECKOUT_INVALID');
  assert.equal(r?.status, 400);
  assert.ok(String(r?.message).includes('HTTPS'));
});
