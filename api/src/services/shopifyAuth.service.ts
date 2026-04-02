import { db } from '../config/database';
import { decryptTenantSecret } from '../utils/tenantSecrets';
import { normalizeShopDomain } from './tenantPosConfig.service';

const TOKEN_REFRESH_BUFFER_MS = 60_000;

type TenantShopifyAuthRow = {
  id: string;
  shopify_store_url: string | null;
  shopify_client_id: string | null;
  shopify_client_secret: string | null;
  shopify_admin_token: string | null;
};

type CachedToken = {
  token: string;
  expiresAtMs: number;
};

const tokenCache = new Map<string, CachedToken>();

export type ShopifyAdminTokenResult = {
  accessToken: string;
  source: 'client_credentials' | 'legacy_admin_token';
  shopDomain: string;
};

export class ShopifyAuthError extends Error {
  code: 'CONFIG_ERROR' | 'AUTH_ERROR' | 'DOMAIN_MISMATCH';

  constructor(code: ShopifyAuthError['code'], message: string) {
    super(message);
    this.name = 'ShopifyAuthError';
    this.code = code;
  }
}

function getShopifyBaseUrl(storeUrl: string): string {
  return `https://${normalizeShopDomain(storeUrl)}`;
}

async function fetchTokenViaClientCredentials(
  shopDomain: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; expiresAtMs: number }> {
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ShopifyAuthError(
      'AUTH_ERROR',
      `Shopify token exchange failed (${response.status}): ${text}`
    );
  }

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) {
    throw new ShopifyAuthError('AUTH_ERROR', 'Shopify token exchange did not return access_token');
  }

  const expiresInSec =
    typeof body.expires_in === 'number' && Number.isFinite(body.expires_in)
      ? body.expires_in
      : 3600;
  return {
    accessToken: body.access_token,
    expiresAtMs: Date.now() + Math.max(expiresInSec, 60) * 1000,
  };
}

export async function getTenantShopifyAdminAccessToken(
  tenantId: string,
  opts?: { forceRefresh?: boolean }
): Promise<ShopifyAdminTokenResult> {
  const tenant = await db<TenantShopifyAuthRow>('tenants').where({ id: tenantId }).first();
  if (!tenant) {
    throw new ShopifyAuthError('CONFIG_ERROR', 'Tenant not found');
  }
  if (!tenant.shopify_store_url) {
    throw new ShopifyAuthError('CONFIG_ERROR', 'Shopify store URL is not configured for this tenant');
  }

  const shopDomain = normalizeShopDomain(tenant.shopify_store_url);
  const clientId = tenant.shopify_client_id?.trim() || null;
  const clientSecret = decryptTenantSecret(tenant.shopify_client_secret);

  if (clientId && clientSecret) {
    const cached = tokenCache.get(tenantId);
    if (
      !opts?.forceRefresh &&
      cached &&
      cached.expiresAtMs > Date.now() + TOKEN_REFRESH_BUFFER_MS
    ) {
      return {
        accessToken: cached.token,
        source: 'client_credentials',
        shopDomain,
      };
    }

    const exchanged = await fetchTokenViaClientCredentials(shopDomain, clientId, clientSecret);
    tokenCache.set(tenantId, {
      token: exchanged.accessToken,
      expiresAtMs: exchanged.expiresAtMs,
    });
    return {
      accessToken: exchanged.accessToken,
      source: 'client_credentials',
      shopDomain,
    };
  }

  const legacyAdminToken = decryptTenantSecret(tenant.shopify_admin_token);
  if (!legacyAdminToken) {
    throw new ShopifyAuthError(
      'CONFIG_ERROR',
      'Shopify credentials are not configured for this tenant'
    );
  }
  console.warn(
    `[shopifyAuth] using legacy_admin_token fallback for tenant ${tenantId}; migrate to client credentials`
  );
  return {
    accessToken: legacyAdminToken,
    source: 'legacy_admin_token',
    shopDomain,
  };
}

export async function fetchTenantShopDomainFromShopify(
  tenantId: string
): Promise<{ configuredShopDomain: string; returnedShopDomain: string; authSource: string }> {
  const tokenResult = await getTenantShopifyAdminAccessToken(tenantId, { forceRefresh: true });
  const url = `${getShopifyBaseUrl(tokenResult.shopDomain)}/admin/api/2025-01/shop.json`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Shopify-Access-Token': tokenResult.accessToken,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new ShopifyAuthError('AUTH_ERROR', `Shop domain probe failed (${response.status}): ${text}`);
  }
  const data = (await response.json()) as {
    shop?: { domain?: string; myshopify_domain?: string };
  };
  const returnedDomain =
    data.shop?.myshopify_domain || data.shop?.domain || tokenResult.shopDomain;
  return {
    configuredShopDomain: tokenResult.shopDomain,
    returnedShopDomain: normalizeShopDomain(returnedDomain),
    authSource: tokenResult.source,
  };
}

export function clearTenantShopifyTokenCache(tenantId: string): void {
  tokenCache.delete(tenantId);
}

