import { db } from '../config/database';
import { shopifyAdminJson } from '../integrations/shopifyAdapter';
import type Stripe from 'stripe';

type ComponentLine = { posProductId: string; quantity: number };

export function parseShopifyVariantNumeric(posVariantId: string | null | undefined): string | null {
  if (!posVariantId) return null;
  const trimmed = posVariantId.trim();
  const m = trimmed.match(/ProductVariant\/(\d+)/);
  if (m) return m[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return null;
}

async function upsertFulfillmentRow(input: {
  tenantId: string;
  customerSubscriptionId: string;
  stripeSubscriptionId: string;
  stripeInvoiceId: string;
  status: string;
  shopifyOrderId?: string | null;
  shopifyOrderName?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  const existing = await db('subscription_fulfillment_cycles')
    .where({ stripe_invoice_id: input.stripeInvoiceId })
    .first();
  if (existing && (existing as { status: string }).status === 'shopify_order_created') {
    return;
  }
  if (existing) {
    await db('subscription_fulfillment_cycles')
      .where({ stripe_invoice_id: input.stripeInvoiceId })
      .update({
        status: input.status,
        shopify_order_id: input.shopifyOrderId ?? null,
        shopify_order_name: input.shopifyOrderName ?? null,
        error_message: input.errorMessage ?? null,
        attempt_count: db.raw('attempt_count + 1'),
        updated_at: db.fn.now(),
      });
    return;
  }
  await db('subscription_fulfillment_cycles').insert({
    tenant_id: input.tenantId,
    customer_subscription_id: input.customerSubscriptionId,
    stripe_invoice_id: input.stripeInvoiceId,
    stripe_subscription_id: input.stripeSubscriptionId,
    status: input.status,
    shopify_order_id: input.shopifyOrderId ?? null,
    shopify_order_name: input.shopifyOrderName ?? null,
    error_message: input.errorMessage ?? null,
    attempt_count: 1,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),
  });
}

/**
 * After invoice.paid: create Shopify order with external payment when tenant flag is on and Shopify is configured.
 */
export async function fulfillSubscriptionInvoice(input: {
  tenantId: string;
  customerSubscriptionId: string;
  stripeSubscriptionId: string;
  stripeInvoiceId: string;
  invoice: Stripe.Invoice;
  bundleComponents: ComponentLine[];
  customerEmail: string;
}): Promise<{ status: string; shopifyOrderId?: string; shopifyOrderName?: string; error?: string }> {
  const tenant = (await db('tenants').where({ id: input.tenantId }).first()) as
    | {
        subscription_shopify_fulfillment_enabled?: boolean;
      }
    | undefined;

  if (!tenant?.subscription_shopify_fulfillment_enabled) {
    await upsertFulfillmentRow({
      tenantId: input.tenantId,
      customerSubscriptionId: input.customerSubscriptionId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeInvoiceId: input.stripeInvoiceId,
      status: 'deferred',
      errorMessage: 'Shopify fulfillment disabled for tenant',
    });
    return { status: 'deferred' };
  }

  const lineItems: Array<{ variant_id: number; quantity: number }> = [];
  for (const line of input.bundleComponents) {
    const pp = (await db('pos_products')
      .where({ id: line.posProductId, tenant_id: input.tenantId })
      .first()) as { pos_variant_id?: string | null } | undefined;
    if (!pp) {
      await upsertFulfillmentRow({
        tenantId: input.tenantId,
        customerSubscriptionId: input.customerSubscriptionId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripeInvoiceId: input.stripeInvoiceId,
        status: 'failed',
        errorMessage: `Unknown pos product ${line.posProductId}`,
      });
      return {
        status: 'failed',
        error: `Unknown pos product ${line.posProductId}`,
      };
    }
    const vid = parseShopifyVariantNumeric(pp.pos_variant_id);
    if (!vid) {
      await upsertFulfillmentRow({
        tenantId: input.tenantId,
        customerSubscriptionId: input.customerSubscriptionId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripeInvoiceId: input.stripeInvoiceId,
        status: 'failed',
        errorMessage: `No Shopify variant id for product ${line.posProductId}`,
      });
      return {
        status: 'failed',
        error: `No Shopify variant id for product ${line.posProductId}`,
      };
    }
    lineItems.push({ variant_id: parseInt(vid, 10), quantity: line.quantity });
  }

  if (lineItems.length === 0) {
    await upsertFulfillmentRow({
      tenantId: input.tenantId,
      customerSubscriptionId: input.customerSubscriptionId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeInvoiceId: input.stripeInvoiceId,
      status: 'failed',
      errorMessage: 'Bundle has no fulfillable line items',
    });
    return { status: 'failed', error: 'Bundle has no fulfillable line items' };
  }

  const amountPaid = input.invoice.amount_paid;
  const currency = (input.invoice.currency || 'usd').toUpperCase();
  const amountStr = (amountPaid / 100).toFixed(2);

  const orderBody = {
    order: {
      email: input.customerEmail,
      line_items: lineItems,
      financial_status: 'paid',
      send_receipt: false,
      note: `Hot Tub Companion subscription — Stripe invoice ${input.stripeInvoiceId}`,
      tags: 'htc-subscription',
      transactions: [
        {
          kind: 'sale',
          status: 'success',
          amount: amountStr,
          gateway: 'external',
          currency,
        },
      ],
    },
  };

  try {
    const res = await shopifyAdminJson(input.tenantId, 'POST', '/orders.json', orderBody);
    const json = (await res.json()) as { order?: { id?: number; name?: string }; errors?: unknown };
    if (!res.ok) {
      const errMsg = JSON.stringify(json.errors ?? json).slice(0, 2000);
      await upsertFulfillmentRow({
        tenantId: input.tenantId,
        customerSubscriptionId: input.customerSubscriptionId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripeInvoiceId: input.stripeInvoiceId,
        status: 'failed',
        errorMessage: errMsg,
      });
      return { status: 'failed', error: errMsg };
    }
    const oid = json.order?.id != null ? String(json.order.id) : undefined;
    const oname = json.order?.name ?? undefined;
    await upsertFulfillmentRow({
      tenantId: input.tenantId,
      customerSubscriptionId: input.customerSubscriptionId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeInvoiceId: input.stripeInvoiceId,
      status: 'shopify_order_created',
      shopifyOrderId: oid,
      shopifyOrderName: oname,
      errorMessage: null,
    });
    return { status: 'shopify_order_created', shopifyOrderId: oid, shopifyOrderName: oname };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await upsertFulfillmentRow({
      tenantId: input.tenantId,
      customerSubscriptionId: input.customerSubscriptionId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeInvoiceId: input.stripeInvoiceId,
      status: 'failed',
      errorMessage: msg,
    });
    return { status: 'failed', error: msg };
  }
}
