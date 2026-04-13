import type Stripe from 'stripe';
import { db } from '../config/database';
import { getStripe, isStripeConfigured } from './stripeClient.service';
import { syncAccountFromStripe } from './stripeConnect.service';
import { fulfillSubscriptionInvoice } from './subscriptionFulfillment.service';

type ComponentLine = { posProductId: string; quantity: number };

async function tryMarkEventProcessed(eventId: string, eventType: string, livemode: boolean): Promise<boolean> {
  try {
    await db('stripe_webhook_events').insert({
      stripe_event_id: eventId,
      event_type: eventType,
      livemode: livemode ? 'true' : 'false',
      processed_at: db.fn.now(),
    });
    return true;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === '23505') return false;
    throw e;
  }
}

function meta(sub: Stripe.Subscription): Record<string, string> {
  const m = sub.metadata || {};
  return {
    tenantId: m.htc_tenant_id || '',
    userId: m.htc_user_id || '',
    bundleId: (m.htc_bundle_id || '').trim(),
    singlePosProductId: (m.htc_single_pos_product_id || '').trim(),
    spaProfileId: m.htc_spa_profile_id || '',
  };
}

async function upsertCustomerSubscriptionFromStripe(sub: Stripe.Subscription): Promise<void> {
  const m = meta(sub);
  if (!m.tenantId || !m.userId) {
    return;
  }
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) return;

  const bundleId = m.bundleId || null;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

  await db('customer_subscriptions')
    .insert({
      user_id: m.userId,
      tenant_id: m.tenantId,
      spa_profile_id: m.spaProfileId || null,
      bundle_id: bundleId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      status: sub.status,
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end === true,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      metadata: sub.metadata as unknown as Record<string, unknown>,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .onConflict('stripe_subscription_id')
    .merge({
      stripe_customer_id: customerId,
      status: sub.status,
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end === true,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      metadata: sub.metadata as unknown as Record<string, unknown>,
      updated_at: db.fn.now(),
    });
}

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  if (!isStripeConfigured()) return;

  const inserted = await tryMarkEventProcessed(event.id, event.type, event.livemode);
  if (!inserted) {
    return;
  }

  const stripeAccountId =
    typeof (event as Stripe.Event & { account?: string }).account === 'string'
      ? (event as Stripe.Event & { account?: string }).account!
      : null;

  switch (event.type) {
    case 'account.updated': {
      const acct = event.data.object as Stripe.Account;
      await syncAccountFromStripe(acct.id);
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await upsertCustomerSubscriptionFromStripe(sub);
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id ?? null;
      if (!subId) break;
      if (!invoice.amount_paid || invoice.amount_paid <= 0) break;

      const stripe = getStripe();
      const sub = (await stripe.subscriptions.retrieve(subId, {
        stripeAccount: stripeAccountId || undefined,
      })) as Stripe.Subscription;

      await upsertCustomerSubscriptionFromStripe(sub);

      const cs = (await db('customer_subscriptions').where({ stripe_subscription_id: sub.id }).first()) as
        | {
            id: string;
            tenant_id: string;
            bundle_id: string | null;
          }
        | undefined;
      if (!cs) break;

      let components: ComponentLine[] = [];
      if (cs.bundle_id) {
        const bundle = (await db('subscription_bundle_definitions').where({ id: cs.bundle_id }).first()) as
          | { components?: unknown }
          | undefined;
        if (bundle?.components && Array.isArray(bundle.components)) {
          components = (bundle.components as ComponentLine[]).filter(
            (c) => c && typeof c.posProductId === 'string' && Number.isFinite(Number(c.quantity))
          );
        }
      } else {
        const pid =
          typeof sub.metadata?.htc_single_pos_product_id === 'string'
            ? sub.metadata.htc_single_pos_product_id.trim()
            : '';
        if (pid) {
          components = [{ posProductId: pid, quantity: 1 }];
        }
      }

      const email =
        invoice.customer_email ||
        (typeof sub.metadata?.htc_user_email === 'string' ? sub.metadata.htc_user_email : '') ||
        '';

      await fulfillSubscriptionInvoice({
        tenantId: cs.tenant_id,
        customerSubscriptionId: cs.id,
        stripeSubscriptionId: sub.id,
        stripeInvoiceId: invoice.id,
        invoice,
        bundleComponents: components,
        customerEmail: email || 'unknown@customer.local',
      });
      break;
    }
    default:
      break;
  }
}
