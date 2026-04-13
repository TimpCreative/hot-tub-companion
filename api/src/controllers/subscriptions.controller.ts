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
import { isStripeConfigured, createBillingPortalSession, createSubscriptionCheckoutSessionForItems } from '../services/stripeConnect.service';
import { getCart } from '../services/storefrontCart.service';
function customerUserId(req: Request): string | null {
  const u = req.user as { id?: string; role?: string } | undefined;
  if (!u?.id || u.role === 'admin') return null;
  return u.id;
}

function userEmail(req: Request): string {
  const u = req.user as { email?: string } | undefined;
  return (u?.email || '').trim().toLowerCase();
}

function parseVariantIdFromMerchandiseGid(gid: string | null | undefined): string | null {
  if (!gid) return null;
  const m = gid.match(/ProductVariant\/(\d+)/);
  return m?.[1] ?? null;
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

export async function postCartSubscriptionCheckout(req: Request, res: Response): Promise<void> {
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
  const email = userEmail(req);
  if (!email) {
    error(res, 'VALIDATION_ERROR', 'User email required for checkout', 400);
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
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }
  if (!tenant.stripe_connect_account_id || !tenant.stripe_connect_charges_enabled) {
    error(res, 'STRIPE_CONNECT_NOT_READY', 'Subscriptions are not available', 403);
    return;
  }
  try {
    const cart = await getCart(tenantId, userId);
    if (!cart?.lines?.length) {
      error(res, 'CART_EMPTY', 'Your cart is empty', 400);
      return;
    }
    const variantIds = [
      ...new Set(
        cart.lines
          .map((l) => parseVariantIdFromMerchandiseGid((l as { merchandiseId?: string | null }).merchandiseId ?? null))
          .filter((v): v is string => !!v)
      ),
    ];
    if (variantIds.length === 0) {
      error(res, 'SUBSCRIPTION_CART_EMPTY', 'No subscription-eligible items in cart', 400);
      return;
    }
    const products = (await db('pos_products')
      .where({ tenant_id: tenantId })
      .whereIn('pos_variant_id', variantIds)
      .select('id', 'title', 'pos_variant_id', 'subscription_eligible', 'subscription_stripe_price_id')) as Array<{
      id: string;
      title: string | null;
      pos_variant_id: string | null;
      subscription_eligible?: boolean;
      subscription_stripe_price_id?: string | null;
    }>;
    const byVariant = new Map(products.map((p) => [String(p.pos_variant_id || ''), p]));
    const qtyByPrice = new Map<string, number>();
    const eligibleProductIds = new Set<string>();
    let eligibleMissingPriceCount = 0;
    for (const line of cart.lines) {
      const variantId = parseVariantIdFromMerchandiseGid((line as { merchandiseId?: string | null }).merchandiseId ?? null);
      if (!variantId) continue;
      const p = byVariant.get(variantId);
      if (!p) continue;
      if (p.subscription_eligible && !p.subscription_stripe_price_id?.trim()) {
        eligibleMissingPriceCount += 1;
      }
      const priceId = p.subscription_eligible ? p.subscription_stripe_price_id?.trim() : '';
      if (!priceId) continue;
      qtyByPrice.set(priceId, (qtyByPrice.get(priceId) ?? 0) + Math.max(1, line.quantity || 1));
      eligibleProductIds.add(p.id);
    }
    const lineItems = [...qtyByPrice.entries()].map(([stripePriceId, quantity]) => ({ stripePriceId, quantity }));
    if (lineItems.length === 0) {
      if (eligibleMissingPriceCount > 0) {
        error(
          res,
          'SUBSCRIPTION_NOT_READY',
          'Some cart items are subscription-eligible but not checkout-ready yet. Save Stripe subscription pricing for those items in Retail Admin and try again.',
          400
        );
        return;
      }
      error(res, 'SUBSCRIPTION_CART_EMPTY', 'No subscription-eligible items in cart', 400);
      return;
    }
    const successUrl = buildSubscriptionsCompleteUrl(tenant.slug, {
      status: 'success',
      session_id: '{CHECKOUT_SESSION_ID}',
    });
    const cancelUrl = buildSubscriptionsCompleteUrl(tenant.slug, { status: 'cancel' });
    const metadata: Record<string, string> = {
      htc_tenant_id: tenantId,
      htc_user_id: userId,
      htc_user_email: email,
      htc_cart_subscription: 'true',
      htc_cart_line_item_count: String(lineItems.length),
      htc_cart_product_ids: [...eligibleProductIds].join(',').slice(0, 450),
    };
    const { url } = await createSubscriptionCheckoutSessionForItems({
      tenant,
      lineItems,
      customerEmail: email,
      successUrl,
      cancelUrl,
      metadata,
    });
    if (!url) {
      error(res, 'CHECKOUT_FAILED', 'Could not create checkout session', 500);
      return;
    }
    success(res, { checkoutPageUrl: url });
  } catch (e) {
    console.error('[subscriptions] cart checkout', e);
    error(res, 'CHECKOUT_FAILED', 'Could not create checkout session', 500);
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
