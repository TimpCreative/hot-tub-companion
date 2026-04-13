import { db } from '../config/database';
import { env, getDashboardHostname } from '../config/environment';
import { signSubscriptionHandoff, type SubscriptionHandoffClaims } from './subscriptionHandoff.service';

export type BundleRow = {
  id: string;
  tenant_id: string;
  title: string;
  slug: string | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  pos_product_id: string | null;
  components: unknown;
  active: boolean;
  sort_order: number;
  hero_subscribe_category: string | null;
  is_kit: boolean;
  bundle_discount_percent?: string | number | null;
  bundle_recurring_unit_amount_cents?: number | null;
};

type ComponentLine = { posProductId: string; quantity: number };

function parseComponents(raw: unknown): ComponentLine[] {
  if (!raw) return [];
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => {
      if (!x || typeof x !== 'object') return null;
      const o = x as { posProductId?: string; quantity?: unknown };
      const id = o.posProductId?.trim();
      const q = Number(o.quantity);
      if (!id || !Number.isFinite(q) || q < 1) return null;
      return { posProductId: id, quantity: Math.floor(q) };
    })
    .filter((x): x is ComponentLine => x != null);
}

/** Kit upsell: multi-component, or single-component when is_kit is not false. */
export function bundleQualifiesForKitUpsell(row: Pick<BundleRow, 'components' | 'is_kit'>): boolean {
  const comps = parseComponents(row.components);
  if (comps.length === 0) return false;
  if (comps.length > 1) return true;
  return row.is_kit !== false;
}

export function productInBundle(row: BundleRow, posProductId: string): boolean {
  if (row.pos_product_id === posProductId) return true;
  return parseComponents(row.components).some((c) => c.posProductId === posProductId);
}

/** True if this POS product is a bundle hero or appears in any bundle components (any active flag). */
export async function posProductReferencedInAnyBundle(posProductId: string, tenantId: string): Promise<boolean> {
  const byHero = await db('subscription_bundle_definitions')
    .where({ tenant_id: tenantId, pos_product_id: posProductId })
    .first();
  if (byHero) return true;
  const rows = (await db('subscription_bundle_definitions').where({ tenant_id: tenantId })) as BundleRow[];
  return rows.some((b) => parseComponents(b.components).some((c) => c.posProductId === posProductId));
}

/** Base origin for tenant dashboard (production: https://slug.host; local: DASHBOARD_BASE with tenant query on paths). */
export function buildTenantDashboardOrigin(tenantSlug: string): string {
  const raw = env.DASHBOARD_BASE.trim();
  const withProto = raw.startsWith('http') ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return withProto.replace(/\/+$/, '');
    }
  } catch {
    /* fall through */
  }
  return `https://${tenantSlug}.${getDashboardHostname()}`;
}

export function buildSubscriptionsCompleteUrl(tenantSlug: string, params: Record<string, string>): string {
  const raw = env.DASHBOARD_BASE.trim();
  const withProto = raw.startsWith('http') ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      const base = withProto.replace(/\/+$/, '');
      const q = new URLSearchParams({ tenant: tenantSlug, ...params });
      return `${base}/subscriptions/complete?${q.toString()}`;
    }
  } catch {
    /* fall through */
  }
  const q = new URLSearchParams(params);
  return `https://${tenantSlug}.${getDashboardHostname()}/subscriptions/complete?${q.toString()}`;
}

export function buildSubscriptionCheckoutPageUrl(tenantSlug: string, handoffToken: string): string {
  const raw = env.DASHBOARD_BASE.trim();
  const withProto = raw.startsWith('http') ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      const base = withProto.replace(/\/+$/, '');
      return `${base}/subscriptions/checkout?tenant=${encodeURIComponent(tenantSlug)}&token=${encodeURIComponent(handoffToken)}`;
    }
  } catch {
    /* fall through */
  }
  const host = getDashboardHostname();
  return `https://${tenantSlug}.${host}/subscriptions/checkout?token=${encodeURIComponent(handoffToken)}`;
}

export async function getActiveBundleForTenant(bundleId: string, tenantId: string): Promise<BundleRow | undefined> {
  const row = await db('subscription_bundle_definitions')
    .where({ id: bundleId, tenant_id: tenantId, active: true })
    .first();
  return row as BundleRow | undefined;
}

/** @deprecated Prefer getSubscriptionOffersForProduct — kept for older clients. */
export async function getBundleByPosProductId(
  posProductId: string,
  tenantId: string
): Promise<BundleRow | undefined> {
  const rows = (await db('subscription_bundle_definitions')
    .where({ tenant_id: tenantId, active: true })
    .orderBy('sort_order')
    .orderBy('title')) as BundleRow[];
  return rows.find((b) => productInBundle(b, posProductId) && bundleQualifiesForKitUpsell(b));
}

export async function getSubscriptionOffersForProduct(
  posProductId: string,
  tenantId: string
): Promise<{
  single: { stripePriceId: string; title: string } | null;
  bundleUpsells: Array<{ bundleId: string; title: string; stripePriceId: string; subtitle?: string }>;
}> {
  const tenant = (await db('tenants').where({ id: tenantId }).first()) as
    | { stripe_connect_charges_enabled?: boolean }
    | undefined;
  const connectReady = Boolean(tenant?.stripe_connect_charges_enabled);

  const product = (await db('pos_products').where({ id: posProductId, tenant_id: tenantId }).first()) as
    | {
        title?: string;
        subscription_eligible?: boolean;
        subscription_stripe_price_id?: string | null;
      }
    | undefined;

  let single: { stripePriceId: string; title: string } | null = null;
  if (
    connectReady &&
    product?.subscription_eligible &&
    product.subscription_stripe_price_id?.trim()
  ) {
    single = {
      stripePriceId: product.subscription_stripe_price_id.trim(),
      title: `Subscribe to ${(product.title || 'this item').slice(0, 120)}`,
    };
  }

  const bundles = (await db('subscription_bundle_definitions')
    .where({ tenant_id: tenantId, active: true })
    .orderBy('sort_order')
    .orderBy('title')) as BundleRow[];

  const bundleUpsells: Array<{ bundleId: string; title: string; stripePriceId: string; subtitle?: string }> = [];
  for (const b of bundles) {
    if (!b.stripe_price_id?.trim()) continue;
    if (!productInBundle(b, posProductId)) continue;
    if (!bundleQualifiesForKitUpsell(b)) continue;
    bundleUpsells.push({
      bundleId: b.id,
      title: b.title,
      stripePriceId: b.stripe_price_id.trim(),
      subtitle: 'Full kit subscription',
    });
  }

  return { single, bundleUpsells };
}

export async function createCheckoutHandoffForUser(input: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  bundleId?: string | null;
  posProductId?: string | null;
  spaProfileId?: string | null;
}): Promise<{ checkoutPageUrl: string; expiresInSeconds: number }> {
  const bundleId = input.bundleId?.trim() || '';
  const posProductId = input.posProductId?.trim() || '';
  if (!!bundleId === !!posProductId) {
    throw new Error('HANDOFF_XOR');
  }

  let claims: SubscriptionHandoffClaims;

  if (bundleId) {
    const bundle = await getActiveBundleForTenant(bundleId, input.tenantId);
    if (!bundle?.stripe_price_id?.trim()) {
      throw new Error('BUNDLE_NOT_FOUND');
    }
    claims = {
      userId: input.userId,
      tenantId: input.tenantId,
      bundleId,
      singlePosProductId: null,
      spaProfileId: input.spaProfileId ?? null,
      email: input.userEmail,
    };
  } else {
    const pp = (await db('pos_products')
      .where({ id: posProductId, tenant_id: input.tenantId })
      .first()) as
      | {
          subscription_eligible?: boolean;
          subscription_stripe_price_id?: string | null;
        }
      | undefined;
    if (!pp?.subscription_eligible || !pp.subscription_stripe_price_id?.trim()) {
      throw new Error('SINGLE_OFFER_NOT_FOUND');
    }
    claims = {
      userId: input.userId,
      tenantId: input.tenantId,
      bundleId: null,
      singlePosProductId: posProductId,
      spaProfileId: input.spaProfileId ?? null,
      email: input.userEmail,
    };
  }

  const token = signSubscriptionHandoff(claims);
  return {
    checkoutPageUrl: buildSubscriptionCheckoutPageUrl(input.tenantSlug, token),
    expiresInSeconds: 900,
  };
}

export async function listBundlesForAdmin(tenantId: string): Promise<BundleRow[]> {
  return db('subscription_bundle_definitions').where({ tenant_id: tenantId }).orderBy('sort_order').orderBy('title');
}

/** Sum of catalog line prices (pos_products.price in cents) × qty; apply discount % for suggested recurring. */
export async function previewBundlePricing(
  tenantId: string,
  components: Array<{ posProductId: string; quantity: number }>,
  bundleDiscountPercent: number | null | undefined
): Promise<{
  subtotalCents: number;
  discountPercent: number;
  suggestedCents: number;
}> {
  const tenant = (await db('tenants').where({ id: tenantId }).first()) as
    | { subscription_bundle_default_discount_percent?: string | number | null }
    | undefined;
  const defaultPct = Number(tenant?.subscription_bundle_default_discount_percent ?? 0);
  const useOverride = bundleDiscountPercent !== undefined && bundleDiscountPercent !== null;
  const raw = useOverride ? Number(bundleDiscountPercent) : defaultPct;
  const clamped = Math.min(100, Math.max(0, Number.isFinite(raw) ? raw : 0));
  const ids = [...new Set(components.map((c) => c.posProductId).filter(Boolean))];
  const rows =
    ids.length > 0
      ? await db('pos_products')
          .where({ tenant_id: tenantId })
          .whereIn('id', ids)
          .select('id', 'price')
      : [];
  const priceMap = new Map(rows.map((r) => [String((r as { id: string }).id), Number((r as { price: number }).price)]));
  let subtotal = 0;
  for (const line of components) {
    const p = priceMap.get(line.posProductId);
    if (p == null || !Number.isFinite(p)) continue;
    subtotal += Math.round(p) * Math.floor(line.quantity);
  }
  const suggested = Math.round(subtotal * (1 - clamped / 100));
  return { subtotalCents: subtotal, discountPercent: clamped, suggestedCents: suggested };
}

export async function enrichBundlesWithPricingPreview(
  tenantId: string,
  bundles: BundleRow[]
): Promise<Array<BundleRow & { previewSubtotalCents: number; previewSuggestedCents: number; previewDiscountPercent: number }>> {
  const tenant = (await db('tenants').where({ id: tenantId }).first()) as
    | { subscription_bundle_default_discount_percent?: string | number | null }
    | undefined;
  const defaultPct = Number(tenant?.subscription_bundle_default_discount_percent ?? 0);
  const out: Array<BundleRow & { previewSubtotalCents: number; previewSuggestedCents: number; previewDiscountPercent: number }> = [];
  for (const b of bundles) {
    const comps = parseComponents(b.components);
    const overridePct =
      b.bundle_discount_percent != null && b.bundle_discount_percent !== ''
        ? Number(b.bundle_discount_percent)
        : null;
    const discountPct = overridePct != null && Number.isFinite(overridePct) ? overridePct : defaultPct;
    const clamped = Math.min(100, Math.max(0, discountPct));
    const ids = [...new Set(comps.map((c) => c.posProductId))];
    const rows =
      ids.length > 0
        ? await db('pos_products')
            .where({ tenant_id: tenantId })
            .whereIn('id', ids)
            .select('id', 'price')
        : [];
    const priceMap = new Map(rows.map((r) => [String((r as { id: string }).id), Number((r as { price: number }).price)]));
    let subtotal = 0;
    for (const line of comps) {
      const p = priceMap.get(line.posProductId);
      if (p == null || !Number.isFinite(p)) continue;
      subtotal += Math.round(p) * Math.floor(line.quantity);
    }
    const suggested = Math.round(subtotal * (1 - clamped / 100));
    out.push({
      ...b,
      previewSubtotalCents: subtotal,
      previewSuggestedCents: suggested,
      previewDiscountPercent: clamped,
    });
  }
  return out;
}

export async function upsertBundle(
  tenantId: string,
  input: {
    id?: string;
    title: string;
    slug?: string | null;
    stripePriceId: string;
    stripeProductId?: string | null;
    posProductId?: string | null;
    components: Array<{ posProductId: string; quantity: number }>;
    active?: boolean;
    sortOrder?: number;
    heroSubscribeCategory?: string | null;
    isKit?: boolean;
    bundleDiscountPercent?: number | null;
    bundleRecurringUnitAmountCents?: number | null;
  }
): Promise<BundleRow> {
  const componentsJson = JSON.stringify(input.components ?? []);
  const stripePriceId = input.stripePriceId.trim();
  if (!stripePriceId) {
    throw new Error('STRIPE_PRICE_REQUIRED');
  }
  const bundleDiscountSql =
    input.bundleDiscountPercent === undefined
      ? undefined
      : input.bundleDiscountPercent === null
        ? null
        : input.bundleDiscountPercent;
  const recurringCents =
    input.bundleRecurringUnitAmountCents != null && Number.isFinite(input.bundleRecurringUnitAmountCents)
      ? Math.round(input.bundleRecurringUnitAmountCents)
      : null;
  if (input.id) {
    const existing = await db('subscription_bundle_definitions').where({ id: input.id, tenant_id: tenantId }).first();
    if (!existing) throw new Error('BUNDLE_NOT_FOUND');
    const patch: Record<string, unknown> = {
      title: input.title.trim().slice(0, 200),
      slug: input.slug?.trim().slice(0, 120) || null,
      stripe_price_id: stripePriceId,
      stripe_product_id: input.stripeProductId?.trim() || null,
      pos_product_id: input.posProductId || null,
      components: componentsJson,
      active: input.active !== false,
      sort_order: input.sortOrder ?? 0,
      hero_subscribe_category: input.heroSubscribeCategory?.trim().slice(0, 80) || null,
      is_kit: input.isKit !== false,
      updated_at: db.fn.now(),
    };
    if (bundleDiscountSql !== undefined) {
      patch.bundle_discount_percent = bundleDiscountSql;
    }
    if (recurringCents !== null) {
      patch.bundle_recurring_unit_amount_cents = recurringCents;
    }
    await db('subscription_bundle_definitions').where({ id: input.id, tenant_id: tenantId }).update(patch);
    const row = await db('subscription_bundle_definitions').where({ id: input.id }).first();
    return row as BundleRow;
  }
  const [inserted] = await db('subscription_bundle_definitions')
    .insert({
      tenant_id: tenantId,
      title: input.title.trim().slice(0, 200),
      slug: input.slug?.trim().slice(0, 120) || null,
      stripe_price_id: stripePriceId,
      stripe_product_id: input.stripeProductId?.trim() || null,
      pos_product_id: input.posProductId || null,
      components: componentsJson,
      active: input.active !== false,
      sort_order: input.sortOrder ?? 0,
      hero_subscribe_category: input.heroSubscribeCategory?.trim().slice(0, 80) || null,
      is_kit: input.isKit !== false,
      bundle_discount_percent: bundleDiscountSql === undefined ? null : bundleDiscountSql,
      bundle_recurring_unit_amount_cents: recurringCents,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');
  return (Array.isArray(inserted) ? inserted[0] : inserted) as BundleRow;
}

export async function deleteBundle(tenantId: string, bundleId: string): Promise<boolean> {
  const n = await db('subscription_bundle_definitions').where({ id: bundleId, tenant_id: tenantId }).del();
  return n > 0;
}

export async function listCustomerSubscriptionsForUser(
  userId: string,
  tenantId: string
): Promise<Record<string, unknown>[]> {
  return db('customer_subscriptions as cs')
    .leftJoin('subscription_bundle_definitions as b', 'cs.bundle_id', 'b.id')
    .where({ 'cs.user_id': userId, 'cs.tenant_id': tenantId })
    .select(
      'cs.id',
      'cs.status',
      'cs.stripe_subscription_id',
      'cs.current_period_end',
      'cs.cancel_at_period_end',
      'cs.canceled_at',
      'cs.bundle_id',
      'b.title as bundle_title',
      'cs.created_at',
      'cs.updated_at'
    )
    .orderBy('cs.created_at', 'desc');
}

export async function listCustomerSubscriptionsForTenant(tenantId: string): Promise<Record<string, unknown>[]> {
  return db('customer_subscriptions as cs')
    .join('users as u', 'cs.user_id', 'u.id')
    .leftJoin('subscription_bundle_definitions as b', 'cs.bundle_id', 'b.id')
    .where('cs.tenant_id', tenantId)
    .whereNull('u.deleted_at')
    .select(
      'cs.id',
      'cs.user_id',
      'u.email as user_email',
      'cs.status',
      'cs.stripe_subscription_id',
      'cs.current_period_end',
      'cs.cancel_at_period_end',
      'b.title as bundle_title',
      'cs.created_at'
    )
    .orderBy('cs.created_at', 'desc');
}
