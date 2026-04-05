import { db } from '../config/database';

export type UpsertOrderReferenceInput = {
  tenantId: string;
  shopifyOrderId: string;
  shopifyOrderNumber: number | null;
  userId: string | null;
  customerEmail: string | null;
};

/**
 * Insert or update a row keyed by (tenant_id, shopify_order_id).
 */
export async function upsertOrderReference(input: UpsertOrderReferenceInput): Promise<void> {
  const {
    tenantId,
    shopifyOrderId,
    shopifyOrderNumber,
    userId,
    customerEmail,
  } = input;
  await db('order_references')
    .insert({
      tenant_id: tenantId,
      shopify_order_id: shopifyOrderId,
      shopify_order_number: shopifyOrderNumber,
      user_id: userId,
      customer_email: customerEmail,
    })
    .onConflict(['tenant_id', 'shopify_order_id'])
    .merge(['shopify_order_number', 'user_id', 'customer_email']);
}
