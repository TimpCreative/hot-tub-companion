import { db } from '../config/database';
import { env, getDashboardHostname } from '../config/environment';
import { signSubscriptionHandoff, type SubscriptionHandoffClaims } from './subscriptionHandoff.service';

type BundleRow = {
  id: string;
  tenant_id: string;
  title: string;
  slug: string | null;
  stripe_price_id: string;
  pos_product_id: string | null;
  components: unknown;
  active: boolean;
  sort_order: number;
  hero_subscribe_category: string | null;
};

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

export async function getBundleByPosProductId(
  posProductId: string,
  tenantId: string
): Promise<BundleRow | undefined> {
  const row = await db('subscription_bundle_definitions')
    .where({ pos_product_id: posProductId, tenant_id: tenantId, active: true })
    .first();
  return row as BundleRow | undefined;
}

export async function createCheckoutHandoffForUser(input: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  bundleId: string;
  spaProfileId?: string | null;
}): Promise<{ checkoutPageUrl: string; expiresInSeconds: number }> {
  const bundle = await getActiveBundleForTenant(input.bundleId, input.tenantId);
  if (!bundle) {
    throw new Error('BUNDLE_NOT_FOUND');
  }
  const claims: SubscriptionHandoffClaims = {
    userId: input.userId,
    tenantId: input.tenantId,
    bundleId: input.bundleId,
    spaProfileId: input.spaProfileId ?? null,
    email: input.userEmail,
  };
  const token = signSubscriptionHandoff(claims);
  return {
    checkoutPageUrl: buildSubscriptionCheckoutPageUrl(input.tenantSlug, token),
    expiresInSeconds: 900,
  };
}

export async function listBundlesForAdmin(tenantId: string): Promise<BundleRow[]> {
  return db('subscription_bundle_definitions').where({ tenant_id: tenantId }).orderBy('sort_order').orderBy('title');
}

export async function upsertBundle(
  tenantId: string,
  input: {
    id?: string;
    title: string;
    slug?: string | null;
    stripePriceId: string;
    posProductId?: string | null;
    components: Array<{ posProductId: string; quantity: number }>;
    active?: boolean;
    sortOrder?: number;
    heroSubscribeCategory?: string | null;
  }
): Promise<BundleRow> {
  const componentsJson = JSON.stringify(input.components ?? []);
  if (input.id) {
    const existing = await db('subscription_bundle_definitions').where({ id: input.id, tenant_id: tenantId }).first();
    if (!existing) throw new Error('BUNDLE_NOT_FOUND');
    await db('subscription_bundle_definitions')
      .where({ id: input.id, tenant_id: tenantId })
      .update({
        title: input.title.trim().slice(0, 200),
        slug: input.slug?.trim().slice(0, 120) || null,
        stripe_price_id: input.stripePriceId.trim(),
        pos_product_id: input.posProductId || null,
        components: componentsJson,
        active: input.active !== false,
        sort_order: input.sortOrder ?? 0,
        hero_subscribe_category: input.heroSubscribeCategory?.trim().slice(0, 80) || null,
        updated_at: db.fn.now(),
      });
    const row = await db('subscription_bundle_definitions').where({ id: input.id }).first();
    return row as BundleRow;
  }
  const [inserted] = await db('subscription_bundle_definitions')
    .insert({
      tenant_id: tenantId,
      title: input.title.trim().slice(0, 200),
      slug: input.slug?.trim().slice(0, 120) || null,
      stripe_price_id: input.stripePriceId.trim(),
      pos_product_id: input.posProductId || null,
      components: componentsJson,
      active: input.active !== false,
      sort_order: input.sortOrder ?? 0,
      hero_subscribe_category: input.heroSubscribeCategory?.trim().slice(0, 80) || null,
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
