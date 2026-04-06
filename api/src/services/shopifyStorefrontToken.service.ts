import { db } from '../config/database';
import { decryptTenantSecret, encryptTenantSecret } from '../utils/tenantSecrets';
import { getTenantShopifyAdminAccessToken, ShopifyAuthError } from './shopifyAuth.service';

const ADMIN_API_VERSION = '2025-01';

/** Stable title so merchants can recognize the token in Shopify admin if listed. */
const STOREFRONT_TOKEN_TITLE = 'Hot Tub Companion (mobile cart)';

const STOREFRONT_ACCESS_TOKEN_CREATE = `
mutation HtcStorefrontAccessTokenCreate($input: StorefrontAccessTokenInput!) {
  storefrontAccessTokenCreate(input: $input) {
    userErrors {
      field
      message
    }
    storefrontAccessToken {
      accessToken
      title
    }
  }
}`;

type CreatePayload = {
  storefrontAccessTokenCreate?: {
    userErrors?: { field?: string[]; message: string }[];
    storefrontAccessToken?: { accessToken?: string; title?: string } | null;
  };
};

export type EnsureStorefrontTokenResult =
  | { ok: true; source: 'already_stored' | 'created' }
  | { ok: false; reason: string };

/**
 * Ensures `shopify_storefront_token` is set by calling Admin API `storefrontAccessTokenCreate`
 * when the tenant uses Shopify POS with Client ID + Secret (or legacy admin token) but has no
 * Storefront token yet. Partner Dashboard apps do not expose this token in the UI.
 */
export async function ensureStorefrontAccessTokenStored(
  tenantId: string
): Promise<EnsureStorefrontTokenResult> {
  const row = (await db('tenants')
    .where({ id: tenantId })
    .select(
      'pos_type',
      'shopify_store_url',
      'shopify_storefront_token',
      'shopify_client_id',
      'shopify_client_secret',
      'shopify_admin_token'
    )
    .first()) as
    | {
        pos_type: string | null;
        shopify_store_url: string | null;
        shopify_storefront_token: string | null;
        shopify_client_id: string | null;
        shopify_client_secret: string | null;
        shopify_admin_token: string | null;
      }
    | undefined;

  if (!row) {
    return { ok: false, reason: 'Tenant not found' };
  }
  if (row.pos_type !== 'shopify') {
    return { ok: false, reason: 'Tenant is not configured for Shopify' };
  }
  if (!row.shopify_store_url?.trim()) {
    return { ok: false, reason: 'Shopify store URL is not configured' };
  }

  const existingEnc = row.shopify_storefront_token;
  if (existingEnc) {
    const existing = decryptTenantSecret(existingEnc)?.trim();
    if (existing) {
      return { ok: true, source: 'already_stored' };
    }
  }

  const hasClientCreds =
    !!row.shopify_client_id?.trim() && !!decryptTenantSecret(row.shopify_client_secret)?.trim();
  const hasLegacyAdmin = !!decryptTenantSecret(row.shopify_admin_token)?.trim();
  if (!hasClientCreds && !hasLegacyAdmin) {
    return {
      ok: false,
      reason:
        'Shopify Admin API credentials are missing (Client ID + Secret or legacy admin token)',
    };
  }

  let adminAccess: { accessToken: string; shopDomain: string };
  try {
    adminAccess = await getTenantShopifyAdminAccessToken(tenantId);
  } catch (e) {
    if (e instanceof ShopifyAuthError) {
      return { ok: false, reason: e.message };
    }
    throw e;
  }

  const shopDomain = adminAccess.shopDomain;
  const url = `https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': adminAccess.accessToken,
    },
    body: JSON.stringify({
      query: STOREFRONT_ACCESS_TOKEN_CREATE,
      variables: { input: { title: STOREFRONT_TOKEN_TITLE } },
    }),
  });

  const text = await res.text();
  let json: { data?: CreatePayload; errors?: { message: string }[] };
  try {
    json = JSON.parse(text) as { data?: CreatePayload; errors?: { message: string }[] };
  } catch {
    return { ok: false, reason: `Shopify Admin GraphQL invalid JSON (${res.status})` };
  }

  if (json.errors?.length) {
    return {
      ok: false,
      reason: json.errors.map((e) => e.message).join('; '),
    };
  }

  const payload = json.data?.storefrontAccessTokenCreate;
  const userErrors = payload?.userErrors ?? [];
  if (userErrors.length) {
    return {
      ok: false,
      reason: userErrors.map((e) => e.message).join('; '),
    };
  }

  const accessToken = payload?.storefrontAccessToken?.accessToken?.trim();
  if (!accessToken) {
    return { ok: false, reason: 'Shopify did not return a storefront access token' };
  }

  await db('tenants')
    .where({ id: tenantId })
    .update({
      shopify_storefront_token: encryptTenantSecret(accessToken),
      updated_at: db.fn.now(),
    });

  return { ok: true, source: 'created' };
}
