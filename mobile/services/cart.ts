import api from './api';

/** Axios rejects with `error.response.data` (plain object), not `Error` — use this for user-visible messages. */
export function messageFromApiReject(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    const err = o.error;
    if (err && typeof err === 'object' && err !== null) {
      const inner = err as Record<string, unknown>;
      if (typeof inner.message === 'string' && inner.message.trim()) {
        return inner.message.trim();
      }
      if (typeof inner.code === 'string' && inner.code.trim()) {
        return inner.code.trim();
      }
    }
    if (typeof o.message === 'string' && o.message.trim()) {
      return o.message.trim();
    }
  }
  return fallback;
}

export type CartLine = {
  id: string;
  quantity: number;
  productTitle: string;
  variantTitle: string;
};

export type Cart = {
  cartId: string;
  checkoutUrl: string | null;
  totalQuantity: number;
  lines: CartLine[];
};

type ApiEnvelope<T> = { success?: boolean; data?: T; error?: { code?: string; message?: string } };

function unwrap<T>(res: unknown, label: string): T {
  const r = res as ApiEnvelope<T>;
  if (r?.success === false || r?.error) {
    const msg = r.error?.message || `${label} failed`;
    throw new Error(msg);
  }
  if (r?.data === undefined) {
    throw new Error(`${label}: missing data`);
  }
  return r.data as T;
}

function logCartFailure(op: string, detail: unknown, err: unknown): void {
  if (__DEV__) {
    console.warn(`[cart] ${op} failed`, detail, err);
  }
}

export async function fetchCart(): Promise<Cart | null> {
  try {
    const res = await api.get('/cart');
    const data = unwrap<{ cart: Cart | null }>(res, 'Cart');
    return data.cart ?? null;
  } catch (e) {
    logCartFailure('GET /cart', '', e);
    throw new Error(messageFromApiReject(e, 'Could not load cart.'));
  }
}

export async function addCartItem(productId: string, quantity = 1): Promise<Cart> {
  try {
    const res = await api.post('/cart/items', { productId, quantity });
    const data = unwrap<{ cart: Cart }>(res, 'Add to cart');
    return data.cart;
  } catch (e) {
    logCartFailure('POST /cart/items', { productId, quantity }, e);
    throw new Error(messageFromApiReject(e, 'Could not add to cart.'));
  }
}

export async function updateCartLine(lineId: string, quantity: number): Promise<Cart> {
  try {
    const res = await api.patch('/cart/lines', { lineId, quantity });
    const data = unwrap<{ cart: Cart }>(res, 'Update cart');
    return data.cart;
  } catch (e) {
    logCartFailure('PATCH /cart/lines', { lineId, quantity }, e);
    throw new Error(messageFromApiReject(e, 'Could not update cart.'));
  }
}

export async function removeCartLine(lineId: string): Promise<Cart> {
  try {
    const res = await api.delete('/cart/lines', { data: { lineId } });
    const data = unwrap<{ cart: Cart }>(res, 'Remove line');
    return data.cart;
  } catch (e) {
    logCartFailure('DELETE /cart/lines', { lineId }, e);
    throw new Error(messageFromApiReject(e, 'Could not remove item.'));
  }
}

export async function fetchCheckoutUrl(): Promise<string> {
  try {
    const res = await api.post('/cart/checkout', {});
    const data = unwrap<{ checkoutUrl: string }>(res, 'Checkout');
    if (!data.checkoutUrl?.trim()) {
      throw new Error('Checkout is not available');
    }
    return data.checkoutUrl.trim();
  } catch (e) {
    logCartFailure('POST /cart/checkout', '', e);
    throw new Error(messageFromApiReject(e, 'Could not start checkout.'));
  }
}
