import api from './api';

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

export async function fetchCart(): Promise<Cart | null> {
  const res = await api.get('/cart');
  const data = unwrap<{ cart: Cart | null }>(res, 'Cart');
  return data.cart ?? null;
}

export async function addCartItem(productId: string, quantity = 1): Promise<Cart> {
  const res = await api.post('/cart/items', { productId, quantity });
  const data = unwrap<{ cart: Cart }>(res, 'Add to cart');
  return data.cart;
}

export async function updateCartLine(lineId: string, quantity: number): Promise<Cart> {
  const res = await api.patch('/cart/lines', { lineId, quantity });
  const data = unwrap<{ cart: Cart }>(res, 'Update cart');
  return data.cart;
}

export async function removeCartLine(lineId: string): Promise<Cart> {
  const res = await api.delete('/cart/lines', { data: { lineId } });
  const data = unwrap<{ cart: Cart }>(res, 'Remove line');
  return data.cart;
}

export async function fetchCheckoutUrl(): Promise<string> {
  const res = await api.post('/cart/checkout', {});
  const data = unwrap<{ checkoutUrl: string }>(res, 'Checkout');
  if (!data.checkoutUrl?.trim()) {
    throw new Error('Checkout is not available');
  }
  return data.checkoutUrl.trim();
}
