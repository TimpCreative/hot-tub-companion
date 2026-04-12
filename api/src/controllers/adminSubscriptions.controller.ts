import type { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import {
  createAccountOnboardingLink,
  createExpressDashboardLink,
  isStripeConfigured,
} from '../services/stripeConnect.service';
import {
  listBundlesForAdmin,
  upsertBundle,
  deleteBundle,
  listCustomerSubscriptionsForTenant,
} from '../services/subscriptions.service';
import { env, getDashboardHostname } from '../config/environment';

function tenantId(req: Request): string | null {
  return req.tenant?.id ?? null;
}

function buildAdminReturnUrl(tenantSlug: string, path: string): string {
  const raw = env.DASHBOARD_BASE.trim();
  const withProto = raw.startsWith('http') ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      const base = withProto.replace(/\/+$/, '');
      return `${base}${path}?tenant=${encodeURIComponent(tenantSlug)}`;
    }
  } catch {
    /* fall through */
  }
  return `https://${tenantSlug}.${getDashboardHostname()}${path}`;
}

export async function getConnectStatus(req: Request, res: Response): Promise<void> {
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  const t = (await db('tenants').where({ id: tid }).first()) as Record<string, unknown> | undefined;
  if (!t) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }
  success(res, {
    stripeConfigured: isStripeConfigured(),
    stripeConnectAccountId: t.stripe_connect_account_id ?? null,
    chargesEnabled: Boolean(t.stripe_connect_charges_enabled),
    payoutsEnabled: Boolean(t.stripe_connect_payouts_enabled),
    detailsSubmitted: Boolean(t.stripe_connect_details_submitted),
    onboardedAt: t.stripe_onboarded_at ?? null,
    subscriptionApplicationFeeBps: t.subscription_application_fee_bps ?? null,
    subscriptionShopifyFulfillmentEnabled: Boolean(t.subscription_shopify_fulfillment_enabled),
  });
}

export async function postConnectOnboardingLink(req: Request, res: Response): Promise<void> {
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  if (!isStripeConfigured()) {
    error(res, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured', 503);
    return;
  }
  const tenant = (await db('tenants').where({ id: tid }).first()) as { slug: string } | undefined;
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }
  const body = req.body as { refreshPath?: string; returnPath?: string };
  const refreshPath = typeof body.refreshPath === 'string' ? body.refreshPath : '/admin/subscriptions/billing';
  const returnPath = typeof body.returnPath === 'string' ? body.returnPath : '/admin/subscriptions/billing';
  try {
    const url = await createAccountOnboardingLink(
      tid,
      buildAdminReturnUrl(tenant.slug, refreshPath),
      buildAdminReturnUrl(tenant.slug, returnPath)
    );
    success(res, { url });
  } catch (e) {
    console.error('[adminSubscriptions] onboarding link', e);
    error(res, 'STRIPE_ERROR', 'Could not create onboarding link', 500);
  }
}

export async function postConnectDashboardLink(req: Request, res: Response): Promise<void> {
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  if (!isStripeConfigured()) {
    error(res, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured', 503);
    return;
  }
  try {
    const url = await createExpressDashboardLink(tid);
    success(res, { url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'STRIPE_CONNECT_NOT_LINKED') {
      error(res, 'NOT_LINKED', 'Connect Stripe first', 400);
      return;
    }
    error(res, 'STRIPE_ERROR', 'Could not create dashboard link', 500);
  }
}

export async function listBundles(req: Request, res: Response): Promise<void> {
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  const rows = await listBundlesForAdmin(tid);
  success(res, {
    bundles: rows.map((b) => ({
      id: b.id,
      title: b.title,
      slug: b.slug,
      stripePriceId: b.stripe_price_id,
      posProductId: b.pos_product_id,
      components: b.components,
      active: b.active,
      sortOrder: b.sort_order,
      heroSubscribeCategory: b.hero_subscribe_category,
    })),
  });
}

export async function postBundle(req: Request, res: Response): Promise<void> {
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  const body = req.body as {
    title?: string;
    stripePriceId?: string;
    components?: Array<{ posProductId: string; quantity: number }>;
    slug?: string;
    posProductId?: string | null;
    active?: boolean;
    sortOrder?: number;
    heroSubscribeCategory?: string | null;
  };
  if (!body.title?.trim() || !body.stripePriceId?.trim()) {
    error(res, 'VALIDATION_ERROR', 'title and stripePriceId are required', 400);
    return;
  }
  const components = Array.isArray(body.components) ? body.components : [];
  for (const c of components) {
    if (!c.posProductId || !Number.isFinite(Number(c.quantity)) || Number(c.quantity) < 1) {
      error(res, 'VALIDATION_ERROR', 'Each component needs posProductId and quantity >= 1', 400);
      return;
    }
    const pp = await db('pos_products').where({ id: c.posProductId, tenant_id: tid }).first();
    if (!pp) {
      error(res, 'VALIDATION_ERROR', `Unknown pos product ${c.posProductId}`, 400);
      return;
    }
  }
  if (body.posProductId) {
    const pp = await db('pos_products').where({ id: body.posProductId, tenant_id: tid }).first();
    if (!pp) {
      error(res, 'VALIDATION_ERROR', 'posProductId must belong to this tenant', 400);
      return;
    }
  }
  try {
    const row = await upsertBundle(tid, {
      title: body.title,
      slug: body.slug,
      stripePriceId: body.stripePriceId,
      posProductId: body.posProductId ?? null,
      components,
      active: body.active,
      sortOrder: body.sortOrder,
      heroSubscribeCategory: body.heroSubscribeCategory,
    });
    success(res, { bundle: row });
  } catch (e) {
    console.error('[adminSubscriptions] post bundle', e);
    error(res, 'INTERNAL_ERROR', 'Failed to save bundle', 500);
  }
}

export async function putBundle(req: Request, res: Response): Promise<void> {
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  const id = req.params.id;
  const body = req.body as {
    title?: string;
    stripePriceId?: string;
    components?: Array<{ posProductId: string; quantity: number }>;
    slug?: string;
    posProductId?: string | null;
    active?: boolean;
    sortOrder?: number;
    heroSubscribeCategory?: string | null;
  };
  if (!body.title?.trim() || !body.stripePriceId?.trim()) {
    error(res, 'VALIDATION_ERROR', 'title and stripePriceId are required', 400);
    return;
  }
  const components = Array.isArray(body.components) ? body.components : [];
  for (const c of components) {
    if (!c.posProductId || !Number.isFinite(Number(c.quantity)) || Number(c.quantity) < 1) {
      error(res, 'VALIDATION_ERROR', 'Each component needs posProductId and quantity >= 1', 400);
      return;
    }
    const pp = await db('pos_products').where({ id: c.posProductId, tenant_id: tid }).first();
    if (!pp) {
      error(res, 'VALIDATION_ERROR', `Unknown pos product ${c.posProductId}`, 400);
      return;
    }
  }
  if (body.posProductId) {
    const pp = await db('pos_products').where({ id: body.posProductId, tenant_id: tid }).first();
    if (!pp) {
      error(res, 'VALIDATION_ERROR', 'posProductId must belong to this tenant', 400);
      return;
    }
  }
  try {
    const row = await upsertBundle(tid, {
      id,
      title: body.title,
      slug: body.slug,
      stripePriceId: body.stripePriceId,
      posProductId: body.posProductId ?? null,
      components,
      active: body.active,
      sortOrder: body.sortOrder,
      heroSubscribeCategory: body.heroSubscribeCategory,
    });
    success(res, { bundle: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'BUNDLE_NOT_FOUND') {
      error(res, 'NOT_FOUND', 'Bundle not found', 404);
      return;
    }
    error(res, 'INTERNAL_ERROR', 'Failed to update bundle', 500);
  }
}

export async function removeBundle(req: Request, res: Response): Promise<void> {
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  const ok = await deleteBundle(tid, req.params.id);
  if (!ok) {
    error(res, 'NOT_FOUND', 'Bundle not found', 404);
    return;
  }
  success(res, { deleted: true });
}

export async function listTenantCustomerSubscriptions(req: Request, res: Response): Promise<void> {
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  const rows = await listCustomerSubscriptionsForTenant(tid);
  success(res, { subscriptions: rows });
}

export async function putSubscriptionSettings(req: Request, res: Response): Promise<void> {
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  const body = req.body as {
    subscriptionApplicationFeeBps?: number | null;
    subscriptionShopifyFulfillmentEnabled?: boolean;
  };
  const update: Record<string, unknown> = {};
  if (body.subscriptionApplicationFeeBps !== undefined) {
    if (body.subscriptionApplicationFeeBps !== null) {
      const n = Number(body.subscriptionApplicationFeeBps);
      if (!Number.isFinite(n) || n < 0 || n > 10000) {
        error(res, 'VALIDATION_ERROR', 'subscriptionApplicationFeeBps must be 0–10000', 400);
        return;
      }
      update.subscription_application_fee_bps = n;
    } else {
      update.subscription_application_fee_bps = null;
    }
  }
  if (body.subscriptionShopifyFulfillmentEnabled !== undefined) {
    update.subscription_shopify_fulfillment_enabled = Boolean(body.subscriptionShopifyFulfillmentEnabled);
  }
  if (Object.keys(update).length === 0) {
    error(res, 'VALIDATION_ERROR', 'No valid fields to update', 400);
    return;
  }
  await db('tenants').where({ id: tid }).update(update);
  const t = (await db('tenants').where({ id: tid }).first()) as Record<string, unknown> | undefined;
  if (!t) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }
  success(res, {
    stripeConfigured: isStripeConfigured(),
    stripeConnectAccountId: t.stripe_connect_account_id ?? null,
    chargesEnabled: Boolean(t.stripe_connect_charges_enabled),
    payoutsEnabled: Boolean(t.stripe_connect_payouts_enabled),
    detailsSubmitted: Boolean(t.stripe_connect_details_submitted),
    onboardedAt: t.stripe_onboarded_at ?? null,
    subscriptionApplicationFeeBps: t.subscription_application_fee_bps ?? null,
    subscriptionShopifyFulfillmentEnabled: Boolean(t.subscription_shopify_fulfillment_enabled),
  });
}
