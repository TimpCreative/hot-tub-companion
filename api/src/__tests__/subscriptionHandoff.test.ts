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
      spaProfileId: null,
      email: 'buyer@example.com',
    });
    const out = verifySubscriptionHandoff(tok);
    assert.equal(out.userId, '11111111-1111-1111-1111-111111111111');
    assert.equal(out.tenantId, '22222222-2222-2222-2222-222222222222');
    assert.equal(out.bundleId, '33333333-3333-3333-3333-333333333333');
    assert.equal(out.spaProfileId, null);
    assert.equal(out.email, 'buyer@example.com');
  });
});
