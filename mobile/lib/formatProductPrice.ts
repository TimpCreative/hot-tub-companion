/**
 * POS product prices from the API are stored and returned in **cents** (minor units).
 */
export function formatProductPriceCents(cents: number | string | null | undefined): string {
  if (cents == null || cents === '') return '';
  const n = typeof cents === 'string' ? parseFloat(cents) : cents;
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n / 100);
}
