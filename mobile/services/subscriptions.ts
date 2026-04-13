import api from './api';

export type SubscriptionBundleRef = {
  id: string;
  title: string;
  stripePriceId?: string;
  posProductId?: string | null;
};

export type SubscriptionOffersData = {
  single: { stripePriceId: string; title: string } | null;
  bundleUpsells: Array<{
    bundleId: string;
    title: string;
    stripePriceId: string;
    subtitle?: string;
    savingsPercent?: number | null;
  }>;
};

export type CustomerSubscriptionRow = {
  id: string;
  status: string;
  stripe_subscription_id: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  canceled_at?: string | null;
  bundle_id?: string | null;
  bundle_title?: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function fetchSubscriptionBundleForProduct(productId: string) {
  return api.get(`/subscriptions/products/${productId}/bundle`) as Promise<{
    success?: boolean;
    data?: { bundle: SubscriptionBundleRef | null };
  }>;
}

export async function fetchSubscriptionOffers(productId: string) {
  return api.get(`/subscriptions/products/${productId}/offers`) as Promise<{
    success?: boolean;
    data?: SubscriptionOffersData;
  }>;
}

export async function postSubscriptionCheckoutHandoff(opts: {
  bundleId?: string;
  posProductId?: string;
  spaProfileId?: string | null;
}) {
  return api.post('/subscriptions/checkout-handoff', {
    bundleId: opts.bundleId,
    posProductId: opts.posProductId,
    spaProfileId: opts.spaProfileId ?? null,
  }) as Promise<{
    success?: boolean;
    data?: { checkoutPageUrl: string; expiresInSeconds: number };
  }>;
}

export async function listMySubscriptions() {
  return api.get('/subscriptions') as Promise<{
    success?: boolean;
    data?: { subscriptions: CustomerSubscriptionRow[] };
  }>;
}

export async function postSubscriptionBillingPortal() {
  return api.post('/subscriptions/billing-portal', {}) as Promise<{
    success?: boolean;
    data?: { url: string };
  }>;
}
