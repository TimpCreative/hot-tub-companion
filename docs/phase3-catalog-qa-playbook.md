# Phase 3 — Large-catalog & reconciliation QA playbook

Use this checklist for **TAB-scale** (or staging with representative volume) validation of Shopify catalog sync, webhooks, and archived/hidden product behavior. Record pass/fail, environment, date, and owner.

## Preconditions

- Tenant has Shopify POS integration configured; `shopify_catalog_sync_enabled` on if testing webhooks + cron.
- `PUBLIC_API_URL` and webhook secrets registered; HMAC delivery verified at least once.
- Mobile app pointed at the same API environment with a **customer** test account (not tenant-admin override).

## 1. Full batched import

- [ ] Run **full** catalog sync from Retailer Admin → Settings → POS (`/admin/settings/pos/sync/batch` until complete).
- [ ] Confirm row counts align with Shopify (variants = rows in `pos_products`).
- [ ] No unbounded errors in API logs; partial page errors documented if any.

## 2. Incremental cron

- [ ] With `CRON_SECRET`, invoke `POST /api/v1/internal/cron/sync-shopify-catalog` (or wait for scheduled run).
- [ ] Confirm `last_cron_product_sync_at` / `last_product_sync_at` advance when changes exist.
- [ ] No duplicate application of the same logical change (spot-check a known SKU).

## 3. Webhook storms (controlled)

- [ ] Burst of `products/update` or `inventory_levels/update` (staging tools or script) does not leave DB inconsistent.
- [ ] Idempotency: replay same `X-Shopify-Webhook-Id` → single effect (receipt table).

## 4. Archived / hidden / OOS

- [ ] Product hidden in admin → excluded from customer shop list (or behaves per product rules).
- [ ] Out-of-stock rows respect `hideOutOfStock` default on shop APIs.
- [ ] Variant-level inventory updates reflect on PDP and cart validation.

## 5. Orphan / mapping edge cases

- [ ] After full import, orphaned POS rows (if any) documented; `pruneOrphanedShopifyPosProductsAfterFullBatchedImport` behavior matches expectation.
- [ ] Mapping status `confirmed` required for cart add; unmapped rows not purchasable.

## 6. Regression spot checks

- [ ] Compare-at and price display on shop list + PDP.
- [ ] Multi-variant PDP: option chips, price/stock follow selected variant; add-to-cart uses variant `pos_products.id`.

## Sign-off

| Role   | Name | Date | Notes |
|--------|------|------|-------|
| Tester |      |      |       |
