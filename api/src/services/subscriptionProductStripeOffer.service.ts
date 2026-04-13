import { db } from '../config/database';
import { isStripeConfigured } from './stripeConnect.service';
import { createRecurringProductAndPrice } from './stripeSubscriptionCatalog.service';

/**
 * Retail price (cents) minus tenant default subscription discount % (0–100).
 * Result is always at least 1 cent so Stripe recurring prices stay valid.
 */
export function computeSubscriptionUnitAmountCentsFromRetail(
  retailCents: number,
  discountPercent: number
): number {
  const pct = Number.isFinite(discountPercent) ? discountPercent : 0;
  const clamped = Math.min(100, Math.max(0, pct));
  const base = Math.round(Number(retailCents) * (1 - clamped / 100));
  return Math.max(1, base);
}

export type PosProductStripeOfferRow = {
  id: string;
  title?: string | null;
  price?: number | null;
  subscription_stripe_product_id?: string | null;
  subscription_stripe_price_id?: string | null;
};

/**
 * When a product is subscription-eligible but has no recurring Stripe Price yet, create one on the
 * connected account using retail price minus `tenants.subscription_bundle_default_discount_percent`.
 * Returns columns to merge into `pos_products`, or null if Stripe cannot be created yet (no Connect,
 * zero price, etc.).
 */
export async function buildStripeSubscriptionOfferPatch(
  tenantId: string,
  existing: PosProductStripeOfferRow
): Promise<Record<string, unknown> | null> {
  if (existing.subscription_stripe_price_id?.trim()) {
    return null;
  }
  if (!isStripeConfigured()) {
    return null;
  }
  const tenant = (await db('tenants').where({ id: tenantId }).first()) as
    | {
        stripe_connect_account_id: string | null;
        stripe_connect_charges_enabled: boolean;
        subscription_bundle_default_discount_percent?: string | number | null;
      }
    | undefined;
  if (!tenant?.stripe_connect_account_id || !tenant.stripe_connect_charges_enabled) {
    return null;
  }
  const retailCents = Math.round(Number(existing.price ?? 0));
  if (!Number.isFinite(retailCents) || retailCents < 1) {
    return null;
  }
  const defaultPct = Number(tenant.subscription_bundle_default_discount_percent ?? 0);
  const unitAmountCents = computeSubscriptionUnitAmountCentsFromRetail(retailCents, defaultPct);

  const out = await createRecurringProductAndPrice({
    connectedAccountId: tenant.stripe_connect_account_id,
    productName: (existing.title || 'Subscription item').trim().slice(0, 200),
    existingStripeProductId: existing.subscription_stripe_product_id?.trim() || null,
    unitAmountCents,
    currency: 'usd',
    interval: 'month',
    archivePriceId: existing.subscription_stripe_price_id?.trim() || null,
  });
  return {
    subscription_stripe_product_id: out.stripeProductId,
    subscription_stripe_price_id: out.stripePriceId,
    subscription_unit_amount_cents: unitAmountCents,
    subscription_currency: 'usd',
    subscription_interval: 'month',
    updated_at: db.fn.now(),
  };
}
