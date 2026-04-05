import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import {
  addCartLine,
  assertCommerceAvailable,
  getCart,
  getCheckoutUrl,
  removeCartLine,
  StorefrontCartError,
  updateCartLineQuantity,
} from '../services/storefrontCart.service';

function getTenantId(req: Request): string | null {
  return req.tenant?.id ?? null;
}

/** Real app user row id only (excludes tenant-admin Firebase overrides). */
function getConsumerUserId(req: Request): string | null {
  const id = req.user?.id;
  if (typeof id !== 'string' || id.startsWith('admin_')) return null;
  return id;
}

function handleCartError(res: Response, err: unknown): void {
  if (err instanceof StorefrontCartError) {
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
    const cart = await getCart(tenantId, userId);
    success(res, { cart });
  } catch (err) {
    handleCartError(res, err);
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
    const cart = await addCartLine(tenantId, userId, productId, quantity);
    success(res, { cart });
  } catch (err) {
    handleCartError(res, err);
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
      const cart = await removeCartLine(tenantId, userId, lineId.trim());
      success(res, { cart });
      return;
    }
    const cart = await updateCartLineQuantity(tenantId, userId, lineId.trim(), quantity);
    success(res, { cart });
  } catch (err) {
    handleCartError(res, err);
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
    const cart = await removeCartLine(tenantId, userId, lineId);
    success(res, { cart });
  } catch (err) {
    handleCartError(res, err);
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
    handleCartError(res, err);
  }
}
