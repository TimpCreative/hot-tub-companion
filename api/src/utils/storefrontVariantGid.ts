/**
 * Maps a Shopify Admin REST numeric variant id (stored as pos_products.pos_variant_id)
 * to a Storefront API ProductVariant GID. Returns null if the value is not a safe numeric id.
 */
export function toStorefrontVariantGid(posVariantId: string | null | undefined): string | null {
  if (posVariantId == null) return null;
  const s = String(posVariantId).trim();
  if (!/^\d{1,20}$/.test(s)) return null;
  return `gid://shopify/ProductVariant/${s}`;
}
