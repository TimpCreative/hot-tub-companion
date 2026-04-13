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
  enrichBundlesWithPricingPreview,
  previewBundlePricing,
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

function requireManageSubscriptions(req: Request, res: Response): boolean {
  const role = (req as Request & { adminRole?: Record<string, unknown> }).adminRole;
  const allowed = !!role && role.can_manage_subscriptions === true;
  if (!allowed) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_subscriptions', 403);
    return false;
  }
  return true;
}

/** Connect status read: subscription admins, product admins (minimal payload), or store settings admins (full read). */
function requireSubscriptionsOrProductsRead(req: Request, res: Response): boolean {
  const role = (req as Request & { adminRole?: Record<string, unknown> }).adminRole;
  const ok =
    !!role &&
    (role.can_manage_subscriptions === true ||
      role.can_manage_products === true ||
      role.can_manage_settings === true);
  if (!ok) {
    error(
      res,
      'FORBIDDEN',
      'Missing permission: can_manage_subscriptions, can_manage_products, or can_manage_settings',
      403
    );
    return false;
  }
  return true;
}

type PricingBody = {
  unitAmountCents: number;
  currency?: string;
  interval?: 'month' | 'year';
};

/** Create or rotate Stripe Product + recurring Price on the connected account (admin never pastes price ids). */
async function createBundleStripePrice(
  tenantId: string,
  productName: string,
  pricing: PricingBody,
  existing: { stripe_price_id?: string | null; stripe_product_id?: string | null } | null
): Promise<{ stripePriceId: string; stripeProductId: string | null }> {
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
    existingStripeProductId: existing?.stripe_product_id?.trim() || null,
    unitAmountCents: u,
    currency: pricing.currency || 'usd',
    interval,
    archivePriceId: existing?.stripe_price_id?.trim() || null,
  });
  return { stripePriceId: out.stripePriceId, stripeProductId: out.stripeProductId };
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
  if (!requireSubscriptionsOrProductsRead(req, res)) return;
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  const role = (req as Request & { adminRole?: Record<string, unknown> }).adminRole;
  const canSub = role?.can_manage_subscriptions === true;
  const canProd = role?.can_manage_products === true;
  /** Product-only admins: bundle default only; everyone else with read access gets full Connect payload. */
  const minimalPayload = canProd && !canSub;
  const t = (await db('tenants').where({ id: tid }).first()) as Record<string, unknown> | undefined;
  if (!t) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }
  const bundleDiscount = Number(
    (t as { subscription_bundle_default_discount_percent?: unknown }).subscription_bundle_default_discount_percent ?? 0
  );
  if (minimalPayload) {
    success(res, {
      stripeConfigured: isStripeConfigured(),
      chargesEnabled: Boolean(t.stripe_connect_charges_enabled),
      subscriptionBundleDefaultDiscountPercent: bundleDiscount,
    });
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
    subscriptionBundleDefaultDiscountPercent: bundleDiscount,
    newProductsSubscriptionEligibleByDefault: Boolean(
      (t as { new_products_subscription_eligible_by_default?: unknown }).new_products_subscription_eligible_by_default !==
        false
    ),
  });
}

export async function postConnectOnboardingLink(req: Request, res: Response): Promise<void> {
  if (!requireManageSubscriptions(req, res)) return;
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
  const refreshPath = typeof body.refreshPath === 'string' ? body.refreshPath : '/admin/settings/subscriptions';
  const returnPath = typeof body.returnPath === 'string' ? body.returnPath : '/admin/settings/subscriptions';
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
  if (!requireManageSubscriptions(req, res)) return;
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
  const enriched = await enrichBundlesWithPricingPreview(tid, rows);
  success(res, {
    bundles: enriched.map((b) => ({
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
      bundleDiscountPercent:
        b.bundle_discount_percent != null && b.bundle_discount_percent !== ''
          ? Number(b.bundle_discount_percent)
          : null,
      bundleRecurringUnitAmountCents: b.bundle_recurring_unit_amount_cents ?? null,
      previewSubtotalCents: b.previewSubtotalCents,
      previewSuggestedCents: b.previewSuggestedCents,
      previewDiscountPercent: b.previewDiscountPercent,
    })),
  });
}

export async function postBundlePreview(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tid = tenantId(req);
  if (!tid) {
    error(res, 'UNAUTHORIZED', 'Tenant required', 401);
    return;
  }
  const body = req.body as {
    components?: Array<{ posProductId: string; quantity: number }>;
    bundleDiscountPercent?: number | null;
  };
  const components = Array.isArray(body.components) ? body.components : [];
  try {
    const { subtotalCents, discountPercent, suggestedCents } = await previewBundlePricing(
      tid,
      components,
      body.bundleDiscountPercent
    );
    success(res, { subtotalCents, discountPercent, suggestedCents });
  } catch (e) {
    console.error('[adminSubscriptions] bundle preview', e);
    error(res, 'INTERNAL_ERROR', 'Could not preview bundle pricing', 500);
  }
}

type BundleWriteBody = {
  title?: string;
  pricing?: PricingBody;
  components?: Array<{ posProductId: string; quantity: number }>;
  slug?: string;
  active?: boolean;
  sortOrder?: number;
  heroSubscribeCategory?: string | null;
  isKit?: boolean;
  bundleDiscountPercent?: number | null;
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
  const idsForEligible = components.map((c) => c.posProductId);
  const eligErr = await assertPosProductsSubscriptionEligible(tid, idsForEligible);
  if (eligErr) {
    throw new Error(`ELIG:${eligErr}`);
  }
  if (!body.pricing || !Number.isFinite(Number(body.pricing.unitAmountCents))) {
    throw new Error('PRICING_REQUIRED');
  }
  if (!isStripeConfigured()) {
    throw new Error('STRIPE_NOT_CONFIGURED');
  }
  return createBundleStripePrice(tid, body.title!.trim(), body.pricing, existing);
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
  if (!hasPricing) {
    error(res, 'VALIDATION_ERROR', 'pricing with unitAmountCents is required', 400);
    return;
  }
  const components = Array.isArray(body.components) ? body.components : [];
  if (components.length < 1) {
    error(res, 'VALIDATION_ERROR', 'Add at least one bundle line item', 400);
    return;
  }
  const firstPos = components[0]?.posProductId ?? null;
  try {
    const { stripePriceId, stripeProductId } = await validateAndResolveBundle(tid, body, null);
    const unitCents = Math.round(Number(body.pricing!.unitAmountCents));
    const row = await upsertBundle(tid, {
      title: body.title,
      slug: body.slug,
      stripePriceId,
      stripeProductId,
      posProductId: firstPos,
      components,
      active: body.active,
      sortOrder: body.sortOrder,
      heroSubscribeCategory: body.heroSubscribeCategory,
      isKit: body.isKit,
      bundleDiscountPercent: body.bundleDiscountPercent ?? null,
      bundleRecurringUnitAmountCents: unitCents,
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
    if (msg === 'PRICING_REQUIRED') {
      error(res, 'VALIDATION_ERROR', 'pricing.unitAmountCents is required', 400);
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
  if (!hasPricing) {
    error(res, 'VALIDATION_ERROR', 'pricing with unitAmountCents is required', 400);
    return;
  }
  const components = Array.isArray(body.components) ? body.components : [];
  if (components.length < 1) {
    error(res, 'VALIDATION_ERROR', 'Add at least one bundle line item', 400);
    return;
  }
  const firstPos = components[0]?.posProductId ?? null;
  const existing = (await db('subscription_bundle_definitions').where({ id, tenant_id: tid }).first()) as
    | { stripe_price_id?: string | null; stripe_product_id?: string | null }
    | undefined;
  if (!existing) {
    error(res, 'NOT_FOUND', 'Bundle not found', 404);
    return;
  }
  try {
    const { stripePriceId, stripeProductId } = await validateAndResolveBundle(tid, body, existing);
    const unitCents = Math.round(Number(body.pricing!.unitAmountCents));
    const row = await upsertBundle(tid, {
      id,
      title: body.title,
      slug: body.slug,
      stripePriceId,
      stripeProductId,
      posProductId: firstPos,
      components,
      active: body.active,
      sortOrder: body.sortOrder,
      heroSubscribeCategory: body.heroSubscribeCategory,
      isKit: body.isKit,
      bundleDiscountPercent: body.bundleDiscountPercent,
      bundleRecurringUnitAmountCents: unitCents,
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
    if (msg === 'PRICING_REQUIRED') {
      error(res, 'VALIDATION_ERROR', 'pricing.unitAmountCents is required', 400);
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
  if (!requireManageSubscriptions(req, res)) return;
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
    subscriptionBundleDefaultDiscountPercent?: number;
    newProductsSubscriptionEligibleByDefault?: boolean;
  };
  const role = (req as Request & { adminRole?: Record<string, unknown> }).adminRole;
  const canSub = role?.can_manage_subscriptions === true;
  const canProd = role?.can_manage_products === true;
  const wantsFee = body.subscriptionApplicationFeeBps !== undefined;
  const wantsFulfill = body.subscriptionShopifyFulfillmentEnabled !== undefined;
  const wantsNewProd = body.newProductsSubscriptionEligibleByDefault !== undefined;
  const wantsBundleDisc = body.subscriptionBundleDefaultDiscountPercent !== undefined;
  const sensitive = wantsFee || wantsFulfill || wantsNewProd;
  if (sensitive && !canSub) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_subscriptions', 403);
    return;
  }
  if (wantsBundleDisc && !canSub && !canProd) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_products or can_manage_subscriptions', 403);
    return;
  }
  if (!canSub && !canProd) {
    error(res, 'FORBIDDEN', 'Missing permission', 403);
    return;
  }
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
  if (body.subscriptionBundleDefaultDiscountPercent !== undefined) {
    const n = Number(body.subscriptionBundleDefaultDiscountPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      error(res, 'VALIDATION_ERROR', 'subscriptionBundleDefaultDiscountPercent must be 0–100', 400);
      return;
    }
    update.subscription_bundle_default_discount_percent = n;
  }
  if (body.newProductsSubscriptionEligibleByDefault !== undefined) {
    update.new_products_subscription_eligible_by_default = Boolean(body.newProductsSubscriptionEligibleByDefault);
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
    subscriptionBundleDefaultDiscountPercent: Number(
      (t as { subscription_bundle_default_discount_percent?: unknown }).subscription_bundle_default_discount_percent ?? 0
    ),
    newProductsSubscriptionEligibleByDefault: Boolean(
      (t as { new_products_subscription_eligible_by_default?: unknown }).new_products_subscription_eligible_by_default !==
        false
    ),
  });
}
