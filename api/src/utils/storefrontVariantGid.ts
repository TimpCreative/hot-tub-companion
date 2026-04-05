const VARIANT_GID_PREFIX = 'gid://shopify/ProductVariant/';

/**
 * Maps a Shopify variant id (numeric string, or full ProductVariant GID) to a Storefront
 * ProductVariant GID. Returns null if the value is not a safe numeric id.
 */
export function toStorefrontVariantGid(posVariantId: string | null | undefined): string | null {
  if (posVariantId == null) return null;
  let s = String(posVariantId).trim();
  if (s.toLowerCase().startsWith(VARIANT_GID_PREFIX.toLowerCase())) {
    s = s.slice(VARIANT_GID_PREFIX.length).split('?')[0].trim();
  }
  if (!/^\d{1,20}$/.test(s)) return null;
  return `${VARIANT_GID_PREFIX}${s}`;
}
