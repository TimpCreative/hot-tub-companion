import { getStripe, isStripeConfigured } from './stripeClient.service';
import { env, getDashboardHostname } from '../config/environment';
import { db } from '../config/database';

export { isStripeConfigured };

type TenantRow = {
  id: string;
  slug: string;
  stripe_connect_account_id: string | null;
  stripe_connect_charges_enabled: boolean;
  subscription_application_fee_bps: number | null;
};

export function applicationFeePercentForTenant(tenant: TenantRow): number {
  const bps = tenant.subscription_application_fee_bps ?? env.SUBSCRIPTION_DEFAULT_APPLICATION_FEE_BPS;
  const pct = bps / 100;
  const clamped = Math.min(100, Math.max(0, pct));
  // Stripe allows at most two decimal places for subscription application_fee_percent.
  return Number(clamped.toFixed(2));
}

export async function createExpressAccountIfNeeded(tenantId: string): Promise<string> {
  const stripe = getStripe();
  const tenant = (await db('tenants').where({ id: tenantId }).first()) as TenantRow | undefined;
  if (!tenant) throw new Error('TENANT_NOT_FOUND');
  if (tenant.stripe_connect_account_id) {
    return tenant.stripe_connect_account_id;
  }
  const account = await stripe.accounts.create({
    type: 'express',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { htc_tenant_id: tenantId },
  });
  await db('tenants').where({ id: tenantId }).update({
    stripe_connect_account_id: account.id,
    stripe_connect_updated_at: db.fn.now(),
  });
  return account.id;
}

export async function createAccountOnboardingLink(
  tenantId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();
  const accountId = await createExpressAccountIfNeeded(tenantId);
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return link.url;
}

export async function createExpressDashboardLink(tenantId: string): Promise<string> {
  const stripe = getStripe();
  const tenant = (await db('tenants').where({ id: tenantId }).first()) as TenantRow | undefined;
  if (!tenant?.stripe_connect_account_id) throw new Error('STRIPE_CONNECT_NOT_LINKED');
  const link = await stripe.accounts.createLoginLink(tenant.stripe_connect_account_id);
  return link.url;
}

/**
 * Accounts V2 + Connect: Checkout in test mode does not support `customer_email` alone; the session
 * must reference an existing Customer on the connected account. Live mode works with either pattern.
 */
export async function getOrCreateCustomerOnConnectedAccount(
  connectedAccountId: string,
  email: string
): Promise<string> {
  const stripe = getStripe();
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error('CUSTOMER_EMAIL_REQUIRED');
  }
  const existing = await stripe.customers.list(
    { email: normalized, limit: 1 },
    { stripeAccount: connectedAccountId }
  );
  if (existing.data.length > 0) {
    return existing.data[0].id;
  }
  const created = await stripe.customers.create(
    { email: normalized, metadata: { htc_source: 'subscription_checkout' } },
    { stripeAccount: connectedAccountId }
  );
  return created.id;
}

export async function syncAccountFromStripe(accountId: string): Promise<void> {
  const stripe = getStripe();
  const acct = await stripe.accounts.retrieve(accountId);
  const updates: Record<string, unknown> = {
    stripe_connect_charges_enabled: acct.charges_enabled === true,
    stripe_connect_payouts_enabled: acct.payouts_enabled === true,
    stripe_connect_details_submitted: acct.details_submitted === true,
    stripe_connect_updated_at: db.fn.now(),
  };
  const row = (await db('tenants').where({ stripe_connect_account_id: accountId }).first()) as
    | { stripe_onboarded_at?: Date | null }
    | undefined;
  if (acct.charges_enabled && acct.details_submitted && row && !row.stripe_onboarded_at) {
    updates.stripe_onboarded_at = db.fn.now();
  }
  await db('tenants').where({ stripe_connect_account_id: accountId }).update(updates);
}

/**
 * Create a Checkout Session for subscription on the connected account (direct charge + application fee %).
 */
export async function createSubscriptionCheckoutSession(input: {
  tenant: TenantRow;
  stripePriceId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<{ url: string | null; sessionId: string }> {
  const stripe = getStripe();
  if (!input.tenant.stripe_connect_account_id) {
    throw new Error('STRIPE_CONNECT_NOT_LINKED');
  }
  if (!input.tenant.stripe_connect_charges_enabled) {
    throw new Error('STRIPE_CONNECT_NOT_READY');
  }
  const applicationFeePercent = applicationFeePercentForTenant(input.tenant);
  const customerId = await getOrCreateCustomerOnConnectedAccount(
    input.tenant.stripe_connect_account_id,
    input.customerEmail
  );
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: input.stripePriceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: input.metadata,
      subscription_data: {
        metadata: input.metadata,
        ...(applicationFeePercent > 0 ? { application_fee_percent: applicationFeePercent } : {}),
      },
    },
    { stripeAccount: input.tenant.stripe_connect_account_id }
  );
  return { url: session.url, sessionId: session.id };
}

export async function createSubscriptionCheckoutSessionForItems(input: {
  tenant: TenantRow;
  lineItems: Array<{ stripePriceId: string; quantity: number }>;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<{ url: string | null; sessionId: string }> {
  const stripe = getStripe();
  if (!input.tenant.stripe_connect_account_id) {
    throw new Error('STRIPE_CONNECT_NOT_LINKED');
  }
  if (!input.tenant.stripe_connect_charges_enabled) {
    throw new Error('STRIPE_CONNECT_NOT_READY');
  }
  const normalized = input.lineItems
    .map((li) => ({ stripePriceId: li.stripePriceId.trim(), quantity: Math.max(1, Math.floor(li.quantity || 1)) }))
    .filter((li) => !!li.stripePriceId);
  if (normalized.length === 0) {
    throw new Error('SUBSCRIPTION_LINE_ITEMS_REQUIRED');
  }
  const applicationFeePercent = applicationFeePercentForTenant(input.tenant);
  const customerId = await getOrCreateCustomerOnConnectedAccount(
    input.tenant.stripe_connect_account_id,
    input.customerEmail
  );
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      customer: customerId,
      line_items: normalized.map((li) => ({ price: li.stripePriceId, quantity: li.quantity })),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: input.metadata,
      subscription_data: {
        metadata: input.metadata,
        ...(applicationFeePercent > 0 ? { application_fee_percent: applicationFeePercent } : {}),
      },
    },
    { stripeAccount: input.tenant.stripe_connect_account_id }
  );
  return { url: session.url, sessionId: session.id };
}

export async function createBillingPortalSession(input: {
  tenant: TenantRow;
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!input.tenant.stripe_connect_account_id) throw new Error('STRIPE_CONNECT_NOT_LINKED');
  const session = await stripe.billingPortal.sessions.create(
    {
      customer: input.stripeCustomerId,
      return_url: input.returnUrl,
    },
    { stripeAccount: input.tenant.stripe_connect_account_id }
  );
  return session.url;
}

export function buildRetailerSubscriptionReturnUrl(tenantSlug: string, path: string): string {
  const host = getDashboardHostname();
  const proto = env.NODE_ENV === 'production' ? 'https' : 'https';
  return `${proto}://${tenantSlug}.${host}${path}`;
}
