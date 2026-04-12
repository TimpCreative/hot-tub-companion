import type { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import { verifySubscriptionHandoff } from '../services/subscriptionHandoff.service';
import {
  getActiveBundleForTenant,
  buildSubscriptionsCompleteUrl,
} from '../services/subscriptions.service';
import { createSubscriptionCheckoutSession, isStripeConfigured } from '../services/stripeConnect.service';

type TenantStripeRow = {
  id: string;
  slug: string;
  stripe_connect_account_id: string | null;
  stripe_connect_charges_enabled: boolean;
  subscription_application_fee_bps: number | null;
};

/**
 * Public: exchange short-lived handoff JWT for a Stripe Checkout redirect URL.
 * No x-tenant-key; tenant is derived from the token.
 */
export async function postStartSubscriptionCheckout(req: Request, res: Response): Promise<void> {
  try {
    if (!isStripeConfigured()) {
      error(res, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured on this server', 503);
      return;
    }
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      error(res, 'VALIDATION_ERROR', 'token is required', 400);
      return;
    }
    let claims;
    try {
      claims = verifySubscriptionHandoff(token);
    } catch {
      error(res, 'INVALID_TOKEN', 'Invalid or expired handoff token', 401);
      return;
    }

    const tenant = (await db('tenants').where({ id: claims.tenantId, status: 'active' }).first()) as
      | TenantStripeRow
      | undefined;
    if (!tenant) {
      error(res, 'NOT_FOUND', 'Tenant not found', 404);
      return;
    }
    if (!tenant.stripe_connect_charges_enabled || !tenant.stripe_connect_account_id) {
      error(res, 'STRIPE_CONNECT_NOT_READY', 'Retailer has not completed Stripe Connect onboarding', 403);
      return;
    }

    const bundle = await getActiveBundleForTenant(claims.bundleId, claims.tenantId);
    if (!bundle) {
      error(res, 'BUNDLE_NOT_FOUND', 'Subscription bundle is not available', 404);
      return;
    }

    const metadata: Record<string, string> = {
      htc_tenant_id: claims.tenantId,
      htc_user_id: claims.userId,
      htc_bundle_id: claims.bundleId,
      htc_spa_profile_id: claims.spaProfileId || '',
      htc_user_email: claims.email,
    };

    const successUrl = buildSubscriptionsCompleteUrl(tenant.slug, {
      status: 'success',
      session_id: '{CHECKOUT_SESSION_ID}',
    });
    const cancelUrl = buildSubscriptionsCompleteUrl(tenant.slug, { status: 'cancel' });

    const { url, sessionId } = await createSubscriptionCheckoutSession({
      tenant,
      stripePriceId: bundle.stripe_price_id,
      customerEmail: claims.email,
      successUrl,
      cancelUrl,
      metadata,
    });

    if (!url) {
      error(res, 'CHECKOUT_FAILED', 'Could not create checkout session', 500);
      return;
    }
    success(res, { url, sessionId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'STRIPE_CONNECT_NOT_READY') {
      error(res, 'STRIPE_CONNECT_NOT_READY', 'Stripe Connect is not ready for charges', 403);
      return;
    }
    console.error('[publicSubscriptions] start-checkout', e);
    error(res, 'INTERNAL_ERROR', 'Failed to start checkout', 500);
  }
}
