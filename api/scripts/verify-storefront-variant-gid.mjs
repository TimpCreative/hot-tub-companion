#!/usr/bin/env node
/**
 * Sanity checks for toStorefrontVariantGid logic (no DB). Run: node scripts/verify-storefront-variant-gid.mjs
 */
import assert from 'node:assert';

const PREFIX = 'gid://shopify/ProductVariant/';
function toStorefrontVariantGid(posVariantId) {
  if (posVariantId == null) return null;
  let s = String(posVariantId).trim();
  if (s.toLowerCase().startsWith(PREFIX.toLowerCase())) {
    s = s.slice(PREFIX.length).split('?')[0].trim();
  }
  if (!/^\d{1,20}$/.test(s)) return null;
  return `${PREFIX}${s}`;
}

assert.strictEqual(toStorefrontVariantGid('12345'), 'gid://shopify/ProductVariant/12345');
assert.strictEqual(
  toStorefrontVariantGid('gid://shopify/ProductVariant/999'),
  'gid://shopify/ProductVariant/999'
);
assert.strictEqual(toStorefrontVariantGid(''), null);
assert.strictEqual(toStorefrontVariantGid('abc'), null);
assert.strictEqual(toStorefrontVariantGid('12a34'), null);
assert.strictEqual(toStorefrontVariantGid(null), null);
assert.strictEqual(toStorefrontVariantGid('0'), 'gid://shopify/ProductVariant/0');
console.log('verify-storefront-variant-gid: ok');
