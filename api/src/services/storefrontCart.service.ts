import { db } from '../config/database';
import { decryptTenantSecret } from '../utils/tenantSecrets';
import { normalizeShopDomain } from './tenantPosConfig.service';
import { toStorefrontVariantGid } from '../utils/storefrontVariantGid';

const STOREFRONT_API_VERSION = '2025-01';

export class StorefrontCartError extends Error {
  code: 'COMMERCE_UNAVAILABLE' | 'STOREFRONT_ERROR' | 'NOT_FOUND' | 'BAD_REQUEST';

  constructor(code: StorefrontCartError['code'], message: string) {
    super(message);
    this.name = 'StorefrontCartError';
    this.code = code;
  }
}

export type CartLineDto = {
  id: string;
  quantity: number;
  productTitle: string;
  variantTitle: string;
};

export type CartDto = {
  cartId: string;
  checkoutUrl: string | null;
  totalQuantity: number;
  lines: CartLineDto[];
};

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            product {
              title
            }
          }
        }
      }
    }
  }
`;

async function loadStorefrontCredentials(
  tenantId: string
): Promise<{ shopDomain: string; token: string } | null> {
  const row = (await db('tenants')
    .select('shopify_store_url', 'shopify_storefront_token')
    .where({ id: tenantId })
    .first()) as { shopify_store_url: string | null; shopify_storefront_token: string | null } | undefined;
  if (!row?.shopify_store_url?.trim()) return null;
  const token = row.shopify_storefront_token ? decryptTenantSecret(row.shopify_storefront_token) : null;
  if (!token?.trim()) return null;
  return {
    shopDomain: normalizeShopDomain(row.shopify_store_url),
    token: token.trim(),
  };
}

async function storefrontGraphql<T>(
  shopDomain: string,
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const url = `https://${shopDomain}/api/${STOREFRONT_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new StorefrontCartError('STOREFRONT_ERROR', `Storefront HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) {
    throw new StorefrontCartError(
      'STOREFRONT_ERROR',
      body.errors.map((e) => e.message).join('; ')
    );
  }
  if (!body.data) {
    throw new StorefrontCartError('STOREFRONT_ERROR', 'Empty GraphQL data');
  }
  return body.data;
}

function parseCart(cart: unknown): CartDto | null {
  if (!cart || typeof cart !== 'object') return null;
  const c = cart as Record<string, unknown>;
  const id = typeof c.id === 'string' ? c.id : null;
  if (!id) return null;
  const checkoutUrl = typeof c.checkoutUrl === 'string' ? c.checkoutUrl : null;
  const totalQuantity = typeof c.totalQuantity === 'number' ? c.totalQuantity : 0;
  const lines: CartLineDto[] = [];
  const linesConn = c.lines as Record<string, unknown> | undefined;
  const edges = linesConn?.edges;
  if (Array.isArray(edges)) {
    for (const e of edges) {
      if (!e || typeof e !== 'object') continue;
      const node = (e as { node?: unknown }).node;
      if (!node || typeof node !== 'object') continue;
      const n = node as Record<string, unknown>;
      const lineId = typeof n.id === 'string' ? n.id : null;
      const qty = typeof n.quantity === 'number' ? n.quantity : 0;
      const merch = n.merchandise as Record<string, unknown> | undefined;
      const variantTitle = typeof merch?.title === 'string' ? merch.title : '';
      const product = merch?.product as Record<string, unknown> | undefined;
      const productTitle = typeof product?.title === 'string' ? product.title : '';
      if (lineId) {
        lines.push({
          id: lineId,
          quantity: qty,
          productTitle,
          variantTitle,
        });
      }
    }
  }
  return { cartId: id, checkoutUrl, totalQuantity, lines };
}

function userErrorsMessage(errors: unknown): string {
  if (!Array.isArray(errors)) return 'Unknown cart error';
  return errors
    .map((e) => {
      if (!e || typeof e !== 'object') return '';
      const o = e as { message?: string };
      return typeof o.message === 'string' ? o.message : '';
    })
    .filter(Boolean)
    .join('; ');
}

export async function assertCommerceAvailable(tenantId: string): Promise<void> {
  const creds = await loadStorefrontCredentials(tenantId);
  if (!creds) {
    throw new StorefrontCartError(
      'COMMERCE_UNAVAILABLE',
      'Storefront checkout is not configured for this dealer.'
    );
  }
}

async function getStoredCartId(tenantId: string, userId: string): Promise<string | null> {
  const row = (await db('user_storefront_carts')
    .select('storefront_cart_id')
    .where({ tenant_id: tenantId, user_id: userId })
    .first()) as { storefront_cart_id: string } | undefined;
  return row?.storefront_cart_id?.trim() || null;
}

async function saveStoredCartId(tenantId: string, userId: string, cartId: string): Promise<void> {
  await db('user_storefront_carts')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      storefront_cart_id: cartId,
      updated_at: db.fn.now(),
    })
    .onConflict(['tenant_id', 'user_id'])
    .merge({
      storefront_cart_id: cartId,
      updated_at: db.fn.now(),
    });
}

async function clearStoredCartId(tenantId: string, userId: string): Promise<void> {
  await db('user_storefront_carts').where({ tenant_id: tenantId, user_id: userId }).delete();
}

async function fetchCartById(
  creds: { shopDomain: string; token: string },
  cartId: string
): Promise<CartDto | null> {
  const q = `
    query CartQuery($cartId: ID!) {
      cart(id: $cartId) {
        ${CART_FIELDS}
      }
    }
  `;
  const data = await storefrontGraphql<{ cart: unknown }>(creds.shopDomain, creds.token, q, { cartId });
  return parseCart(data.cart);
}

async function createEmptyCart(creds: { shopDomain: string; token: string }): Promise<CartDto> {
  const m = `
    mutation CartCreate {
      cartCreate(input: { lines: [] }) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }
  `;
  const data = await storefrontGraphql<{
    cartCreate: { cart: unknown; userErrors: unknown };
  }>(creds.shopDomain, creds.token, m);
  const errs = data.cartCreate?.userErrors;
  if (Array.isArray(errs) && errs.length > 0) {
    throw new StorefrontCartError('STOREFRONT_ERROR', userErrorsMessage(errs));
  }
  const cart = parseCart(data.cartCreate?.cart);
  if (!cart) {
    throw new StorefrontCartError('STOREFRONT_ERROR', 'cartCreate returned no cart');
  }
  return cart;
}

export async function getOrCreateCart(tenantId: string, userId: string): Promise<CartDto> {
  const creds = await loadStorefrontCredentials(tenantId);
  if (!creds) {
    throw new StorefrontCartError(
      'COMMERCE_UNAVAILABLE',
      'Storefront checkout is not configured for this dealer.'
    );
  }

  const stored = await getStoredCartId(tenantId, userId);
  if (stored) {
    const existing = await fetchCartById(creds, stored);
    if (existing) return existing;
    await clearStoredCartId(tenantId, userId);
  }

  const created = await createEmptyCart(creds);
  await saveStoredCartId(tenantId, userId, created.cartId);
  return created;
}

export async function getCart(tenantId: string, userId: string): Promise<CartDto | null> {
  const creds = await loadStorefrontCredentials(tenantId);
  if (!creds) {
    throw new StorefrontCartError(
      'COMMERCE_UNAVAILABLE',
      'Storefront checkout is not configured for this dealer.'
    );
  }
  const stored = await getStoredCartId(tenantId, userId);
  if (!stored) return null;
  const cart = await fetchCartById(creds, stored);
  if (!cart) {
    await clearStoredCartId(tenantId, userId);
    return null;
  }
  return cart;
}

export type ResolvedPosProduct = {
  posProductId: string;
  title: string;
  merchandiseId: string;
  inventoryQuantity: number;
};

export async function resolvePurchasableProduct(
  tenantId: string,
  posProductId: string
): Promise<ResolvedPosProduct | null> {
  const row = (await db('pos_products')
    .select('id', 'title', 'pos_variant_id', 'inventory_quantity', 'is_hidden', 'mapping_status')
    .where({ tenant_id: tenantId, id: posProductId })
    .first()) as {
    id: string;
    title: string | null;
    pos_variant_id: string | null;
    inventory_quantity: number | null;
    is_hidden: boolean;
    mapping_status: string | null;
  } | undefined;
  if (!row) return null;
  if (row.is_hidden || row.mapping_status !== 'confirmed') return null;
  const gid = toStorefrontVariantGid(row.pos_variant_id);
  if (!gid) return null;
  const inv = typeof row.inventory_quantity === 'number' ? row.inventory_quantity : 0;
  if (inv <= 0) return null;
  return {
    posProductId: row.id,
    title: row.title || 'Product',
    merchandiseId: gid,
    inventoryQuantity: inv,
  };
}

export async function addCartLine(
  tenantId: string,
  userId: string,
  posProductId: string,
  quantity: number
): Promise<CartDto> {
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
    throw new StorefrontCartError('BAD_REQUEST', 'Quantity must be between 1 and 99');
  }
  const resolved = await resolvePurchasableProduct(tenantId, posProductId);
  if (!resolved) {
    throw new StorefrontCartError('NOT_FOUND', 'Product is not available for purchase');
  }
  if (quantity > resolved.inventoryQuantity) {
    throw new StorefrontCartError('BAD_REQUEST', 'Not enough stock available');
  }

  const creds = await loadStorefrontCredentials(tenantId);
  if (!creds) {
    throw new StorefrontCartError('COMMERCE_UNAVAILABLE', 'Storefront checkout is not configured for this dealer.');
  }

  let cart = await getOrCreateCart(tenantId, userId);
  const m = `
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }
  `;
  const data = await storefrontGraphql<{
    cartLinesAdd: { cart: unknown; userErrors: unknown };
  }>(creds.shopDomain, creds.token, m, {
    cartId: cart.cartId,
    lines: [{ merchandiseId: resolved.merchandiseId, quantity }],
  });
  const errs = data.cartLinesAdd?.userErrors;
  if (Array.isArray(errs) && errs.length > 0) {
    const msg = userErrorsMessage(errs);
    if (/does not exist|not found|invalid/i.test(msg)) {
      await clearStoredCartId(tenantId, userId);
      cart = await getOrCreateCart(tenantId, userId);
      const retry = await storefrontGraphql<{
        cartLinesAdd: { cart: unknown; userErrors: unknown };
      }>(creds.shopDomain, creds.token, m, {
        cartId: cart.cartId,
        lines: [{ merchandiseId: resolved.merchandiseId, quantity }],
      });
      const e2 = retry.cartLinesAdd?.userErrors;
      if (Array.isArray(e2) && e2.length > 0) {
        throw new StorefrontCartError('STOREFRONT_ERROR', userErrorsMessage(e2));
      }
      const parsed = parseCart(retry.cartLinesAdd?.cart);
      if (!parsed) throw new StorefrontCartError('STOREFRONT_ERROR', 'cartLinesAdd returned no cart');
      await saveStoredCartId(tenantId, userId, parsed.cartId);
      return parsed;
    }
    throw new StorefrontCartError('STOREFRONT_ERROR', msg);
  }
  const parsed = parseCart(data.cartLinesAdd?.cart);
  if (!parsed) throw new StorefrontCartError('STOREFRONT_ERROR', 'cartLinesAdd returned no cart');
  await saveStoredCartId(tenantId, userId, parsed.cartId);
  return parsed;
}

export async function updateCartLineQuantity(
  tenantId: string,
  userId: string,
  lineId: string,
  quantity: number
): Promise<CartDto> {
  if (!lineId?.trim()) {
    throw new StorefrontCartError('BAD_REQUEST', 'lineId is required');
  }
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 99) {
    throw new StorefrontCartError('BAD_REQUEST', 'Quantity must be between 0 and 99');
  }
  const creds = await loadStorefrontCredentials(tenantId);
  if (!creds) {
    throw new StorefrontCartError('COMMERCE_UNAVAILABLE', 'Storefront checkout is not configured for this dealer.');
  }
  const stored = await getStoredCartId(tenantId, userId);
  if (!stored) {
    throw new StorefrontCartError('NOT_FOUND', 'No cart yet');
  }

  const m = `
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }
  `;
  const data = await storefrontGraphql<{
    cartLinesUpdate: { cart: unknown; userErrors: unknown };
  }>(creds.shopDomain, creds.token, m, {
    cartId: stored,
    lines: [{ id: lineId.trim(), quantity }],
  });
  const errs = data.cartLinesUpdate?.userErrors;
  if (Array.isArray(errs) && errs.length > 0) {
    throw new StorefrontCartError('STOREFRONT_ERROR', userErrorsMessage(errs));
  }
  const parsed = parseCart(data.cartLinesUpdate?.cart);
  if (!parsed) throw new StorefrontCartError('STOREFRONT_ERROR', 'cartLinesUpdate returned no cart');
  await saveStoredCartId(tenantId, userId, parsed.cartId);
  return parsed;
}

export async function removeCartLine(tenantId: string, userId: string, lineId: string): Promise<CartDto> {
  if (!lineId?.trim()) {
    throw new StorefrontCartError('BAD_REQUEST', 'lineId is required');
  }
  const creds = await loadStorefrontCredentials(tenantId);
  if (!creds) {
    throw new StorefrontCartError('COMMERCE_UNAVAILABLE', 'Storefront checkout is not configured for this dealer.');
  }
  const stored = await getStoredCartId(tenantId, userId);
  if (!stored) {
    throw new StorefrontCartError('NOT_FOUND', 'No cart yet');
  }

  const m = `
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }
  `;
  const data = await storefrontGraphql<{
    cartLinesRemove: { cart: unknown; userErrors: unknown };
  }>(creds.shopDomain, creds.token, m, {
    cartId: stored,
    lineIds: [lineId.trim()],
  });
  const errs = data.cartLinesRemove?.userErrors;
  if (Array.isArray(errs) && errs.length > 0) {
    throw new StorefrontCartError('STOREFRONT_ERROR', userErrorsMessage(errs));
  }
  const parsed = parseCart(data.cartLinesRemove?.cart);
  if (!parsed) throw new StorefrontCartError('STOREFRONT_ERROR', 'cartLinesRemove returned no cart');
  await saveStoredCartId(tenantId, userId, parsed.cartId);
  return parsed;
}

export async function getCheckoutUrl(tenantId: string, userId: string): Promise<string> {
  const cart = await getCart(tenantId, userId);
  if (!cart?.checkoutUrl?.trim()) {
    throw new StorefrontCartError('BAD_REQUEST', 'Cart is empty or checkout is not available');
  }
  return cart.checkoutUrl.trim();
}
