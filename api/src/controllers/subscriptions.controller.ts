import type { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import {
  buildSubscriptionsCompleteUrl,
  createCheckoutHandoffForUser,
  getBundleByPosProductId,
  getSubscriptionOffersForProduct,
  listCustomerSubscriptionsForUser,
} from '../services/subscriptions.service';
import { isStripeConfigured, createBillingPortalSession } from '../services/stripeConnect.service';
function customerUserId(req: Request): string | null {
  const u = req.user as { id?: string; role?: string } | undefined;
  if (!u?.id || u.role === 'admin') return null;
  return u.id;
}

function userEmail(req: Request): string {
  const u = req.user as { email?: string } | undefined;
  return (u?.email || '').trim().toLowerCase();
}

export async function postCheckoutHandoff(req: Request, res: Response): Promise<void> {
  const userId = customerUserId(req);
  if (!userId) {
    error(res, 'FORBIDDEN', 'Customer session required', 403);
    return;
  }
  if (!isStripeConfigured()) {
    error(res, 'STRIPE_NOT_CONFIGURED', 'Subscriptions are not available', 503);
    return;
  }
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  const body = req.body as { bundleId?: string; posProductId?: string; spaProfileId?: string | null };
  const bundleId = typeof body.bundleId === 'string' ? body.bundleId.trim() : '';
  const posProductId = typeof body.posProductId === 'string' ? body.posProductId.trim() : '';
  if (!bundleId && !posProductId) {
    error(res, 'VALIDATION_ERROR', 'bundleId or posProductId is required', 400);
    return;
  }
  if (bundleId && posProductId) {
    error(res, 'VALIDATION_ERROR', 'Provide only one of bundleId or posProductId', 400);
    return;
  }
  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }
  const email = userEmail(req);
  if (!email) {
    error(res, 'VALIDATION_ERROR', 'User email required for checkout', 400);
    return;
  }
  try {
    const out = await createCheckoutHandoffForUser({
      tenantId,
      tenantSlug: (tenant as { slug: string }).slug,
      userId,
      userEmail: email,
      bundleId: bundleId || null,
      posProductId: posProductId || null,
      spaProfileId: body.spaProfileId ?? null,
    });
    success(res, out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'BUNDLE_NOT_FOUND') {
      error(res, 'BUNDLE_NOT_FOUND', 'Bundle not found or inactive', 404);
      return;
    }
    if (msg === 'SINGLE_OFFER_NOT_FOUND') {
      error(res, 'SINGLE_OFFER_NOT_FOUND', 'Single-item subscription is not available for this product', 404);
      return;
    }
    if (msg === 'HANDOFF_XOR') {
      error(res, 'VALIDATION_ERROR', 'Invalid checkout target', 400);
      return;
    }
    throw e;
  }
}

/** Resolve bundle for a product (PDP Subscribe) — legacy; prefer getSubscriptionOffersForProduct. */
export async function getSubscriptionBundleForProduct(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  const productId = req.params.productId;
  if (!productId) {
    error(res, 'VALIDATION_ERROR', 'productId required', 400);
    return;
  }
  const bundle = await getBundleByPosProductId(productId, tenantId);
  if (!bundle) {
    success(res, { bundle: null });
    return;
  }
  success(res, {
    bundle: {
      id: bundle.id,
      title: bundle.title,
      stripePriceId: bundle.stripe_price_id ?? undefined,
      posProductId: bundle.pos_product_id,
    },
  });
}

/** Single + kit upsells for PDP. */
export async function getSubscriptionOffersForProductHandler(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  const productId = req.params.productId;
  if (!productId) {
    error(res, 'VALIDATION_ERROR', 'productId required', 400);
    return;
  }
  const offers = await getSubscriptionOffersForProduct(productId, tenantId);
  success(res, offers);
}

export async function listMySubscriptions(req: Request, res: Response): Promise<void> {
  const userId = customerUserId(req);
  if (!userId) {
    error(res, 'FORBIDDEN', 'Customer session required', 403);
    return;
  }
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  const rows = await listCustomerSubscriptionsForUser(userId, tenantId);
  success(res, { subscriptions: rows });
}

export async function postBillingPortal(req: Request, res: Response): Promise<void> {
  const userId = customerUserId(req);
  if (!userId) {
    error(res, 'FORBIDDEN', 'Customer session required', 403);
    return;
  }
  if (!isStripeConfigured()) {
    error(res, 'STRIPE_NOT_CONFIGURED', 'Subscriptions are not available', 503);
    return;
  }
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  const tenant = (await db('tenants').where({ id: tenantId }).first()) as
    | {
        id: string;
        slug: string;
        stripe_connect_account_id: string | null;
        stripe_connect_charges_enabled: boolean;
        subscription_application_fee_bps: number | null;
      }
    | undefined;
  if (!tenant?.stripe_connect_account_id || !tenant.stripe_connect_charges_enabled) {
    error(res, 'STRIPE_CONNECT_NOT_READY', 'Billing portal is not available', 403);
    return;
  }
  const sub = (await db('customer_subscriptions')
    .where({ user_id: userId, tenant_id: tenantId })
    .orderBy('created_at', 'desc')
    .first()) as { stripe_customer_id: string } | undefined;
  if (!sub) {
    error(res, 'NOT_FOUND', 'No subscription found', 404);
    return;
  }
  const returnUrl = buildSubscriptionsCompleteUrl(tenant.slug, { status: 'portal_return' });
  try {
    const url = await createBillingPortalSession({
      tenant,
      stripeCustomerId: sub.stripe_customer_id,
      returnUrl,
    });
    success(res, { url });
  } catch (e) {
    console.error('[subscriptions] billing portal', e);
    error(res, 'PORTAL_FAILED', 'Could not create billing portal session', 500);
  }
}
