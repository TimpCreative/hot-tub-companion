import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/environment';
import type { AdminProductListFilters } from '../services/adminProductsQuery.service';

export const BULK_TOKEN_TTL_SEC = 900;
export const BULK_APPLY_MAX_ROWS = 25_000;

const FILTER_KEYS = [
  'search',
  'mappingStatus',
  'isHidden',
  'shopifyCollectionId',
  'vendor',
  'productType',
  'inStock',
  'priceMin',
  'priceMax',
  'tag',
  'sort',
] as const;

export function stableSerializeFilters(f: AdminProductListFilters): string {
  const o: Record<string, string | number> = {};
  for (const k of FILTER_KEYS) {
    const v = f[k];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'string' || typeof v === 'number') o[k] = v;
  }
  const sortedKeys = Object.keys(o).sort();
  const normalized: Record<string, string | number> = {};
  for (const k of sortedKeys) normalized[k] = o[k];
  return JSON.stringify(normalized);
}

export function signBulkProductSelectionToken(
  tenantId: string,
  filters: AdminProductListFilters
): { token: string; expiresAtIso: string } {
  const exp = Math.floor(Date.now() / 1000) + BULK_TOKEN_TTL_SEC;
  const body = stableSerializeFilters(filters);
  const sig = createHmac('sha256', env.JWT_SECRET)
    .update(`${tenantId}|${exp}|${body}`)
    .digest('hex');
  const token = Buffer.from(
    JSON.stringify({ tenantId, exp, body, sig }),
    'utf8'
  ).toString('base64url');
  return { token, expiresAtIso: new Date(exp * 1000).toISOString() };
}

export function verifyBulkProductSelectionToken(
  token: string
): { tenantId: string; filters: AdminProductListFilters } | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as {
      tenantId?: string;
      exp?: number;
      body?: string;
      sig?: string;
    };
    const { tenantId, exp, body, sig } = parsed;
    if (
      typeof tenantId !== 'string' ||
      typeof exp !== 'number' ||
      typeof body !== 'string' ||
      typeof sig !== 'string'
    ) {
      return null;
    }
    if (exp < Math.floor(Date.now() / 1000)) return null;
    const expect = createHmac('sha256', env.JWT_SECRET)
      .update(`${tenantId}|${exp}|${body}`)
      .digest('hex');
    if (
      expect.length !== sig.length ||
      !timingSafeEqual(Buffer.from(expect, 'hex'), Buffer.from(sig, 'hex'))
    ) {
      return null;
    }
    const filters = JSON.parse(body) as AdminProductListFilters;
    return { tenantId, filters };
  } catch {
    return null;
  }
}
