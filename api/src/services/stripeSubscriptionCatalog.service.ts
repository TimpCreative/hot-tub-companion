import { getStripe } from './stripeClient.service';

export type SubscriptionPriceInterval = 'month' | 'year';

/**
 * Create or reuse a Stripe Product on the connected account and attach a new recurring Price.
 * Optionally deactivate a previous price id on the same account.
 */
export async function createRecurringProductAndPrice(input: {
  connectedAccountId: string;
  productName: string;
  existingStripeProductId?: string | null;
  unitAmountCents: number;
  currency: string;
  interval: SubscriptionPriceInterval;
  /** When changing pricing, archive the old recurring price on the connected account. */
  archivePriceId?: string | null;
}): Promise<{ stripeProductId: string; stripePriceId: string }> {
  const stripe = getStripe();
  const currency = input.currency.trim().toLowerCase() || 'usd';
  if (!Number.isFinite(input.unitAmountCents) || input.unitAmountCents < 1) {
    throw new Error('INVALID_UNIT_AMOUNT');
  }

  let productId = input.existingStripeProductId?.trim() || '';
  if (!productId) {
    const product = await stripe.products.create(
      { name: input.productName.trim().slice(0, 200) },
      { stripeAccount: input.connectedAccountId }
    );
    productId = product.id;
  }

  const price = await stripe.prices.create(
    {
      product: productId,
      unit_amount: Math.round(input.unitAmountCents),
      currency,
      recurring: { interval: input.interval },
    },
    { stripeAccount: input.connectedAccountId }
  );

  if (input.archivePriceId?.trim() && input.archivePriceId !== price.id) {
    try {
      await stripe.prices.update(
        input.archivePriceId.trim(),
        { active: false },
        { stripeAccount: input.connectedAccountId }
      );
    } catch {
      /* best-effort archive */
    }
  }

  return { stripeProductId: productId, stripePriceId: price.id };
}
