export type ShopStockDisplayConfig = {
  lowStockThreshold: number;
  showInStockWhenAboveThreshold: boolean;
};

const DEFAULTS: ShopStockDisplayConfig = {
  lowStockThreshold: 5,
  showInStockWhenAboveThreshold: true,
};

/**
 * Line shown under price on product detail. Returns null to render nothing.
 * - Out of stock always shown when quantity ≤ 0.
 * - "Only N left" when 0 < quantity ≤ threshold (threshold 0 disables that line for in-stock).
 * - "In stock" when quantity > threshold if showInStockWhenAboveThreshold.
 */
export function productDetailStockLine(
  inventoryQuantity: number,
  config?: Partial<ShopStockDisplayConfig> | null
): string | null {
  const threshold =
    typeof config?.lowStockThreshold === 'number' && Number.isFinite(config.lowStockThreshold)
      ? Math.min(999, Math.max(0, Math.trunc(config.lowStockThreshold)))
      : DEFAULTS.lowStockThreshold;
  const showInStock =
    typeof config?.showInStockWhenAboveThreshold === 'boolean'
      ? config.showInStockWhenAboveThreshold
      : DEFAULTS.showInStockWhenAboveThreshold;

  const stock = typeof inventoryQuantity === 'number' && Number.isFinite(inventoryQuantity) ? inventoryQuantity : 0;

  if (stock <= 0) return 'Out of stock';
  if (threshold > 0 && stock <= threshold) return `Only ${stock} left`;
  if (showInStock) return 'In stock';
  return null;
}
