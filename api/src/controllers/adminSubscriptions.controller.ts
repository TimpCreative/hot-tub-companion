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
import { createRecurringProductAndPrice } from '../services/stripeSubscriptionCatalog.service';
import { env, getDashboardHostname } from '../config/environment';

function tenantId(req: Request): string | null {
  return req.tenant?.id ?? null;
}

function requireManageProducts(req: Request, res: Response): boolean {
  const role = (req as Request & { adminRole?: Record<string, unknown> }).adminRole;
  const allowed = !!role && role.can_manage_products === true;
  if (!allowed) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_products', 403);
    return false;
  }
  return true;
}

type PricingBody = {
  unitAmountCents: number;
  currency?: string;
  interval?: 'month' | 'year';
};

async function resolveBundleStripeCatalog(
  tenantId: string,
  productName: string,
  body: {
    stripePriceId?: string;
    stripeProductId?: string | null;
    pricing?: PricingBody;
  },
  existing: { stripe_price_id?: string | null; stripe_product_id?: string | null } | null
): Promise<{ stripePriceId: string; stripeProductId: string | null }> {
  const pricing = body.pricing;
  if (pricing && Number.isFinite(Number(pricing.unitAmountCents))) {
    const tenant = (await db('tenants').where({ id: tenantId }).first()) as
      | {
          stripe_connect_account_id: string | null;
          stripe_connect_charges_enabled: boolean;
        }
      | undefined;
    if (!tenant?.stripe_connect_account_id || !tenant.stripe_connect_charges_enabled) {
      throw new Error('STRIPE_CONNECT_NOT_READY');
    }
    const acct = tenant.stripe_connect_account_id;
    const u = Math.round(Number(pricing.unitAmountCents));
    if (u < 1) throw new Error('INVALID_UNIT_AMOUNT');
    const interval = pricing.interval === 'year' ? 'year' : 'month';
    const out = await createRecurringProductAndPrice({
      connectedAccountId: acct,
      productName,
      existingStripeProductId:
        existing?.stripe_product_id?.trim() || body.stripeProductId?.trim() || null,
      unitAmountCents: u,
      currency: pricing.currency || 'usd',
      interval,
      archivePriceId: existing?.stripe_price_id?.trim() || null,
    });
    return { stripePriceId: out.stripePriceId, stripeProductId: out.stripeProductId };
  }
  const sid = body.stripePriceId?.trim();
  if (!sid) throw new Error('PRICE_REQUIRED');
  return {
    stripePriceId: sid,
    stripeProductId: body.stripeProductId?.trim() || existing?.stripe_product_id?.trim() || null,
  };
}

async function assertPosProductsSubscriptionEligible(
  tenantId: string,
  ids: string[]
): Promise<string | null> {
  const uniq = [...new Set(ids.filter(Boolean))];
  for (const id of uniq) {
    const pp = (await db('pos_products').where({ id, tenant_id: tenantId }).first()) as
      | { subscription_eligible?: boolean }
      | undefined;
    if (!pp) return `Unknown pos product ${id}`;
    if (!pp.subscription_eligible) {
      return `Product ${id} must be subscription-eligible (enable on All products first)`;
    }
  }
  return null;
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
  if (!requireManageProducts(req, res)) return;
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
      stripeProductId: b.stripe_product_id,
      posProductId: b.pos_product_id,
      components: b.components,
      active: b.active,
      sortOrder: b.sort_order,
      heroSubscribeCategory: b.hero_subscribe_category,
      isKit: b.is_kit !== false,
    })),
  });
}

type BundleWriteBody = {
  title?: string;
  stripePriceId?: string;
  stripeProductId?: string | null;
  pricing?: PricingBody;
  components?: Array<{ posProductId: string; quantity: number }>;
  slug?: string;
  posProductId?: string | null;
  active?: boolean;
  sortOrder?: number;
  heroSubscribeCategory?: string | null;
  isKit?: boolean;
};

async function validateAndResolveBundle(
  tid: string,
  body: BundleWriteBody,
  existing: { stripe_price_id?: string | null; stripe_product_id?: string | null } | null
): Promise<{ stripePriceId: string; stripeProductId: string | null }> {
  const components = Array.isArray(body.components) ? body.components : [];
  for (const c of components) {
    if (!c.posProductId || !Number.isFinite(Number(c.quantity)) || Number(c.quantity) < 1) {
      throw new Error('BAD_COMPONENTS');
    }
  }
  const heroId = body.posProductId?.trim() || '';
  const idsForEligible = [...components.map((c) => c.posProductId), ...(heroId ? [heroId] : [])];
  const eligErr = await assertPosProductsSubscriptionEligible(tid, idsForEligible);
  if (eligErr) {
    throw new Error(`ELIG:${eligErr}`);
  }
  const needsStripeApi = body.pricing != null && Number.isFinite(Number(body.pricing.unitAmountCents));
  if (needsStripeApi && !isStripeConfigured()) {
    throw new Error('STRIPE_NOT_CONFIGURED');
  }
  return resolveBundleStripeCatalog(tid, body.title!.trim(), body, existing);
}

export async function postBundle(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  const body = req.body as BundleWriteBody;
  if (!body.title?.trim()) {
    error(res, 'VALIDATION_ERROR', 'title is required', 400);
    return;
  }
  const hasPricing = body.pricing != null && Number.isFinite(Number(body.pricing.unitAmountCents));
  const hasPriceId = !!body.stripePriceId?.trim();
  if (!hasPricing && !hasPriceId) {
    error(res, 'VALIDATION_ERROR', 'Provide subscription pricing or a Stripe price id', 400);
    return;
  }
  const components = Array.isArray(body.components) ? body.components : [];
  if (components.length < 1) {
    error(res, 'VALIDATION_ERROR', 'Add at least one bundle line item', 400);
    return;
  }
  try {
    const { stripePriceId, stripeProductId } = await validateAndResolveBundle(tid, body, null);
    const row = await upsertBundle(tid, {
      title: body.title,
      slug: body.slug,
      stripePriceId,
      stripeProductId,
      posProductId: body.posProductId ?? null,
      components,
      active: body.active,
      sortOrder: body.sortOrder,
      heroSubscribeCategory: body.heroSubscribeCategory,
      isKit: body.isKit,
    });
    success(res, { bundle: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'BAD_COMPONENTS') {
      error(res, 'VALIDATION_ERROR', 'Each component needs posProductId and quantity >= 1', 400);
      return;
    }
    if (msg.startsWith('ELIG:')) {
      error(res, 'VALIDATION_ERROR', msg.slice(5), 400);
      return;
    }
    if (msg === 'STRIPE_NOT_CONFIGURED') {
      error(res, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured', 503);
      return;
    }
    if (msg === 'STRIPE_CONNECT_NOT_READY') {
      error(res, 'STRIPE_CONNECT_NOT_READY', 'Complete Stripe Connect onboarding before creating prices', 403);
      return;
    }
    if (msg === 'INVALID_UNIT_AMOUNT') {
      error(res, 'VALIDATION_ERROR', 'unitAmountCents must be a positive integer', 400);
      return;
    }
    if (msg === 'PRICE_REQUIRED') {
      error(res, 'VALIDATION_ERROR', 'Stripe price id is required when pricing is omitted', 400);
      return;
    }
    console.error('[adminSubscriptions] post bundle', e);
    error(res, 'INTERNAL_ERROR', 'Failed to save bundle', 500);
  }
}

export async function putBundle(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  const id = req.params.id;
  const body = req.body as BundleWriteBody;
  if (!body.title?.trim()) {
    error(res, 'VALIDATION_ERROR', 'title is required', 400);
    return;
  }
  const hasPricing = body.pricing != null && Number.isFinite(Number(body.pricing.unitAmountCents));
  const hasPriceId = !!body.stripePriceId?.trim();
  if (!hasPricing && !hasPriceId) {
    error(res, 'VALIDATION_ERROR', 'Provide subscription pricing or a Stripe price id', 400);
    return;
  }
  const components = Array.isArray(body.components) ? body.components : [];
  if (components.length < 1) {
    error(res, 'VALIDATION_ERROR', 'Add at least one bundle line item', 400);
    return;
  }
  const existing = (await db('subscription_bundle_definitions').where({ id, tenant_id: tid }).first()) as
    | { stripe_price_id?: string | null; stripe_product_id?: string | null }
    | undefined;
  if (!existing) {
    error(res, 'NOT_FOUND', 'Bundle not found', 404);
    return;
  }
  try {
    const { stripePriceId, stripeProductId } = await validateAndResolveBundle(tid, body, existing);
    const row = await upsertBundle(tid, {
      id,
      title: body.title,
      slug: body.slug,
      stripePriceId,
      stripeProductId,
      posProductId: body.posProductId ?? null,
      components,
      active: body.active,
      sortOrder: body.sortOrder,
      heroSubscribeCategory: body.heroSubscribeCategory,
      isKit: body.isKit,
    });
    success(res, { bundle: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'BAD_COMPONENTS') {
      error(res, 'VALIDATION_ERROR', 'Each component needs posProductId and quantity >= 1', 400);
      return;
    }
    if (msg.startsWith('ELIG:')) {
      error(res, 'VALIDATION_ERROR', msg.slice(5), 400);
      return;
    }
    if (msg === 'STRIPE_NOT_CONFIGURED') {
      error(res, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured', 503);
      return;
    }
    if (msg === 'STRIPE_CONNECT_NOT_READY') {
      error(res, 'STRIPE_CONNECT_NOT_READY', 'Complete Stripe Connect onboarding before creating prices', 403);
      return;
    }
    if (msg === 'INVALID_UNIT_AMOUNT') {
      error(res, 'VALIDATION_ERROR', 'unitAmountCents must be a positive integer', 400);
      return;
    }
    if (msg === 'PRICE_REQUIRED') {
      error(res, 'VALIDATION_ERROR', 'Stripe price id is required when pricing is omitted', 400);
      return;
    }
    if (msg === 'BUNDLE_NOT_FOUND') {
      error(res, 'NOT_FOUND', 'Bundle not found', 404);
      return;
    }
    console.error('[adminSubscriptions] put bundle', e);
    error(res, 'INTERNAL_ERROR', 'Failed to update bundle', 500);
  }
}

export async function removeBundle(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
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
