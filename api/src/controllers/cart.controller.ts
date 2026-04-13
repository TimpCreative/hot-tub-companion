import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import {
  addCartLine,
  assertCommerceAvailable,
  CartDto,
  getCart,
  getCheckoutUrl,
  removeCartLine,
  StorefrontCartError,
  updateCartLineQuantity,
} from '../services/storefrontCart.service';
import { logPosIntegrationActivity } from '../services/posIntegrationActivity.service';

function getTenantId(req: Request): string | null {
  return req.tenant?.id ?? null;
}

/** Real app user row id only (excludes tenant-admin Firebase overrides). */
function getConsumerUserId(req: Request): string | null {
  const id = req.user?.id;
  if (typeof id !== 'string' || id.startsWith('admin_')) return null;
  return id;
}

function handleCartError(res: Response, err: unknown, opts?: { tenantId: string | null }): void {
  if (err instanceof StorefrontCartError) {
    if (opts?.tenantId && err.code === 'STOREFRONT_ERROR') {
      void logPosIntegrationActivity(opts.tenantId, {
        eventType: 'storefront_cart_mutation_failed',
        summary: err.message.slice(0, 500),
        source: 'system',
      });
    }
    const status =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'BAD_REQUEST'
          ? 400
          : err.code === 'COMMERCE_UNAVAILABLE'
            ? 503
            : 502;
    error(res, err.code, err.message, status);
    return;
  }
  console.warn('[cart] unexpected error:', err);
  error(res, 'INTERNAL_ERROR', 'Cart operation failed', 500);
}

function parseVariantIdFromMerchandiseGid(gid: string | null | undefined): string | null {
  if (!gid) return null;
  const m = gid.match(/ProductVariant\/(\d+)/);
  return m?.[1] ?? null;
}

async function enrichCartSubscriptionFlags(tenantId: string, cart: CartDto | null): Promise<CartDto | null> {
  if (!cart || cart.lines.length === 0) return cart;
  const variantIds = [
    ...new Set(
      cart.lines
        .map((l) => parseVariantIdFromMerchandiseGid((l as { merchandiseId?: string | null }).merchandiseId ?? null))
        .filter((v): v is string => !!v)
    ),
  ];
  if (variantIds.length === 0) {
    return {
      ...cart,
      lines: cart.lines.map((l) => ({ ...l, subscriptionEligible: false })),
    } as CartDto;
  }
  const rows = (await db('pos_products')
    .where({ tenant_id: tenantId })
    .whereIn('pos_variant_id', variantIds)
    .select('id', 'pos_variant_id', 'subscription_eligible', 'subscription_stripe_price_id')) as Array<{
    id: string;
    pos_variant_id: string | null;
    subscription_eligible?: boolean;
    subscription_stripe_price_id?: string | null;
  }>;
  const byVariant = new Map(rows.map((r) => [String(r.pos_variant_id || ''), r]));
  return {
    ...cart,
    lines: cart.lines.map((l) => {
      const variantId = parseVariantIdFromMerchandiseGid((l as { merchandiseId?: string | null }).merchandiseId ?? null);
      const r = variantId ? byVariant.get(variantId) : undefined;
      const eligible = Boolean(r?.subscription_eligible);
      const checkoutReady = Boolean(r?.subscription_eligible && r.subscription_stripe_price_id?.trim());
      return {
        ...l,
        posProductId: r?.id ?? null,
        subscriptionEligible: eligible,
        subscriptionCheckoutReady: checkoutReady,
      };
    }),
  } as CartDto;
}

export async function getCartState(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const userId = getConsumerUserId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Sign in with your customer account to use the cart', 401);
    return;
  }
  try {
    await assertCommerceAvailable(tenantId);
    const cart = await enrichCartSubscriptionFlags(tenantId, await getCart(tenantId, userId));
    success(res, { cart });
  } catch (err) {
    handleCartError(res, err, { tenantId });
  }
}

export async function postCartItem(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const userId = getConsumerUserId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Sign in with your customer account to use the cart', 401);
    return;
  }
  const body = req.body as { productId?: string; quantity?: number };
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  const quantity = typeof body.quantity === 'number' ? body.quantity : 1;
  if (!productId) {
    error(res, 'VALIDATION_ERROR', 'productId is required', 400);
    return;
  }
  try {
    const cart = await enrichCartSubscriptionFlags(tenantId, await addCartLine(tenantId, userId, productId, quantity));
    success(res, { cart });
  } catch (err) {
    handleCartError(res, err, { tenantId });
  }
}

export async function patchCartLine(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const userId = getConsumerUserId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Sign in with your customer account to use the cart', 401);
    return;
  }
  const body = req.body as { lineId?: string; quantity?: number };
  const lineId = typeof body.lineId === 'string' ? body.lineId : '';
  const quantity = body.quantity;
  if (!lineId.trim()) {
    error(res, 'VALIDATION_ERROR', 'lineId is required', 400);
    return;
  }
  if (typeof quantity !== 'number') {
    error(res, 'VALIDATION_ERROR', 'quantity is required', 400);
    return;
  }
  try {
    if (quantity === 0) {
      const cart = await enrichCartSubscriptionFlags(tenantId, await removeCartLine(tenantId, userId, lineId.trim()));
      success(res, { cart });
      return;
    }
    const cart = await enrichCartSubscriptionFlags(
      tenantId,
      await updateCartLineQuantity(tenantId, userId, lineId.trim(), quantity)
    );
    success(res, { cart });
  } catch (err) {
    handleCartError(res, err, { tenantId });
  }
}

export async function deleteCartLine(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const userId = getConsumerUserId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Sign in with your customer account to use the cart', 401);
    return;
  }
  const body = req.body as { lineId?: string };
  const lineId = typeof body.lineId === 'string' ? body.lineId.trim() : '';
  if (!lineId) {
    error(res, 'VALIDATION_ERROR', 'lineId is required', 400);
    return;
  }
  try {
    const cart = await enrichCartSubscriptionFlags(tenantId, await removeCartLine(tenantId, userId, lineId));
    success(res, { cart });
  } catch (err) {
    handleCartError(res, err, { tenantId });
  }
}

export async function postCartCheckout(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const userId = getConsumerUserId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Sign in with your customer account to use the cart', 401);
    return;
  }
  try {
    const checkoutUrl = await getCheckoutUrl(tenantId, userId);
    success(res, { checkoutUrl });
  } catch (err) {
    handleCartError(res, err, { tenantId });
  }
}
