import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('subscription handoff JWT', () => {
  it('roundtrips claims when JWT_SECRET is set before module load', async () => {
    process.env.JWT_SECRET = 'test-handoff-secret-min-32-characters!!';
    const { signSubscriptionHandoff, verifySubscriptionHandoff, SUBSCRIPTION_HANDOFF_AUDIENCE } = await import(
      '../services/subscriptionHandoff.service'
    );
    assert.equal(SUBSCRIPTION_HANDOFF_AUDIENCE, 'subscription_handoff');
    const tok = signSubscriptionHandoff({
      userId: '11111111-1111-1111-1111-111111111111',
      tenantId: '22222222-2222-2222-2222-222222222222',
      bundleId: '33333333-3333-3333-3333-333333333333',
      singlePosProductId: null,
      spaProfileId: null,
      email: 'buyer@example.com',
    });
    const out = verifySubscriptionHandoff(tok);
    assert.equal(out.userId, '11111111-1111-1111-1111-111111111111');
    assert.equal(out.tenantId, '22222222-2222-2222-2222-222222222222');
    assert.equal(out.bundleId, '33333333-3333-3333-3333-333333333333');
    assert.equal(out.singlePosProductId, null);
    assert.equal(out.spaProfileId, null);
    assert.equal(out.email, 'buyer@example.com');
  });

  it('roundtrips single-product handoff claims', async () => {
    process.env.JWT_SECRET = 'test-handoff-secret-min-32-characters!!';
    const { signSubscriptionHandoff, verifySubscriptionHandoff } = await import(
      '../services/subscriptionHandoff.service'
    );
    const tok = signSubscriptionHandoff({
      userId: '11111111-1111-1111-1111-111111111111',
      tenantId: '22222222-2222-2222-2222-222222222222',
      bundleId: null,
      singlePosProductId: '44444444-4444-4444-4444-444444444444',
      spaProfileId: null,
      email: 'buyer@example.com',
    });
    const out = verifySubscriptionHandoff(tok);
    assert.equal(out.bundleId, null);
    assert.equal(out.singlePosProductId, '44444444-4444-4444-4444-444444444444');
  });
});
