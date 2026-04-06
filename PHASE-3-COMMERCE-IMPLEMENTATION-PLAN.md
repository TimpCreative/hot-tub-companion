# Phase 3 Commerce Implementation Plan

This document turns the Phase 3 commerce roadmap into a practical implementation plan, starting with security hardening for Take A Break's live Shopify integration.

## Shopify Platform Direction

Shopify's current app-platform direction is centered on the **Dev Dashboard** plus **Shopify CLI-managed app configuration** rather than dashboard-only app setup. For app teams, Shopify now expects app configuration to live in code (`shopify.app.toml` and related config files), with `shopify app deploy` used to release app versions and extensions. If an app already exists in the Dev Dashboard, Shopify recommends importing and linking it into a local CLI project rather than continuing to manage it only in the dashboard. [Shopify CLI for apps](https://shopify.dev/docs/apps/build/cli-for-apps) [Migrate from a Dev Dashboard-managed app](https://shopify.dev/docs/apps/build/cli-for-apps/migrate-from-dashboard)

For Hot Tub Companion, this now translates to one clear implementation direction:

- each tenant connects Shopify through a Dev Dashboard app
- credentials are saved in HTC POS Integration per tenant
- backend exchanges credentials for short-lived access tokens at runtime
- tenant-to-shop domain matching is mandatory for isolation

Shopify CLI remains useful for broader app-lifecycle workflows, but the tenant onboarding path in this phase is Dev Dashboard credentials in POS Integration.

## Status Review

_Updated to match the repository during Phase 3 commerce work._

### Implemented

- Shopify tenant secrets encrypted at rest; decrypt only at point of use; legacy plaintext read paths still supported
- POS config APIs return configured-state booleans, not raw secrets; Retailer + Super Admin write-only secret fields; shared `tenantPosConfig` flows
- **Runtime Admin token** — client credentials exchange + in-memory cache (`shopifyAuth.service`)
- **Storefront token** — optional in POS; **auto-provision** via Admin `storefrontAccessTokenCreate` when Client ID/Secret work (`shopifyStorefrontToken.service`; POS save / test / lazy cart)
- **Shop read APIs** — `GET /products/shop`, `.../shop/categories`, `.../shop/price-bounds` (auth); compatibility via `shopProductCompatibility.service` (incl. rules for parts with no `part_spa_compatibility` rows)
- **PDP API** — product detail with compatibility for mobile
- **Cart** — Storefront proxy routes (`cart.routes.ts`, `storefrontCart.service`); variant GID helper; server-persisted cart id per user
- **Mobile** — Shop (search, filters, list rows + add-to-cart), PDP (multi-variant + related strip), cart, **Checkout Kit**, **active spa** persistence, checkout lifecycle messaging (webhook SoT)
- **Orders read API** — `GET /api/v1/orders`, `GET /api/v1/orders/by-shopify/:id` (tenant + user scoped); **Home Recent orders** card
- **`order_references`** + **`orders/create`** upsert; **webhook idempotency** for orders and catalog via `shopify_webhook_receipts` / `X-Shopify-Webhook-Id`
- **Push notification** to matched tenant user on order (email match)
- Dev Dashboard–first tenant onboarding via POS Integration

### Recently added (catalog freshness)

- **`products/update`** and **`inventory_levels/update`** webhooks with HMAC verification; idempotency via `shopify_webhook_receipts` and `X-Shopify-Webhook-Id`
- Per-tenant **`shopify_catalog_sync_enabled`** toggle; webhook registration/removal on enable/disable; requires **`PUBLIC_API_URL`** for callback addresses
- Internal cron: **`POST /api/v1/internal/cron/sync-shopify-catalog`** (with **`CRON_SECRET`**) every 1–2 minutes for incremental `updated_at_min` pulls; throttled by **`product_sync_interval_minutes`** (1–1440). Catalog webhooks: **`products/create`**, **`products/update`**, **`products/delete`**, **`inventory_levels/update`**.
- Retailer **full catalog import** and sync APIs moved to **`/api/v1/admin/settings/pos/sync/*`** with **`can_manage_settings`**

### Retailer Admin: Products and UHTD mapping UX

**Implemented (supports pilot checklist: “Confirm sufficient UHTD / POS mapping”):**

- **`uhtdProductSuggestions.service`** — shared scoring pipeline for suggestions and list enrichment; **`getTopSuggestionScore`** for max match after dedupe.
- **`GET /admin/products`** — left join **`pcdb_parts`** for **`uhtd_part_name`** / **`uhtd_part_number`**; non-confirmed rows enriched with **`top_suggestion_score`** (bounded concurrency); sorts: **`is_hidden_*`**, **`mapping_status_*`**, **`mapping_confidence_*`** (nulls last).
- **Dashboard `/admin/products`** — tiered % pills (red / orange / yellow) for suggestion or confirmed confidence, sortable column headers in sync with sort dropdown, modal shows **Product mapping** when confirmed (with clear → reload suggestions).

**Follow-ups (optional / later):** batch or denormalized scores if list pages feel slow at high **`pageSize`**; deep link from modal to super-admin part record if/when that route exists.

### Partial

- **Product sync QA (1.1 / Milestone 6)** — retry/backoff shipped; **execute** large-catalog + archived reconciliation runs using `docs/phase3-catalog-qa-playbook.md` and record results.

### Shipped in this phase (commerce completion)

1. **Orders read path** — `GET` list/detail from `order_references` + mobile Home **Recent orders** card; rate limit on reads.
2. **PDP** — variant list from API + option picker; **`GET /products/shop/:id/related`** + PDP “You may also need” strip.
3. **Multi-spa** — persisted active `spaProfileId` (per tenant) + Shop picker modal; PDP/shop use shared context.
4. **Sync hardening** — `fetchWithShopifyTransientRetry` on Admin REST (`shopifyAdapter`) and Storefront GraphQL (`storefrontCart.service`).
5. **Observability** — `GET /admin/settings/pos/health`; dashboard shows last logged failure snippet; Storefront cart mutation failures → `pos_integration_activity`.
6. **Checkout UX** — Checkout Sheet Kit `close` + `error` listeners; cart banner copy aligned with webhook-as-truth.
7. **Audit artifacts** — `docs/zero-trust-commerce-audit-2026-04-02.md` (checklist); formal **Milestone 6** execution still required for TAB sign-off.

### Not yet started / still open

- **Milestone 6** — execute full pilot QA matrix in production-like conditions and attach evidence; update sign-off table in the zero-trust doc.

## Goals

- Build commerce in a way that protects retailer data and credentials
- Keep payments fully inside Shopify's trusted checkout flow
- Preserve strict tenant isolation across all commerce surfaces
- Roll out in milestones so we can validate safely before exposing checkout to real customers

## Core Principles

1. Shopify is the source of truth for checkout and orders.
2. We never collect or store payment data.
3. Shopify credentials and runtime tokens never reach the mobile app.
4. Every commerce operation is tenant-scoped and server-verified.
5. Webhooks are authoritative for order confirmation and reconciliation.
6. Security hardening happens before cart and checkout work.
7. Per-tenant Dev Dashboard credentials are the canonical onboarding model for commerce.

## Current State

### Already in place

- Shopify Admin product sync with **cursor pagination**; encrypted credentials; runtime token exchange
- **`orders/create`** and catalog webhooks: HMAC, **idempotency receipts**, `order_references` upsert
- Storefront cart/checkout proxy, mobile Shop + PDP + cart + Checkout Kit
- Product compatibility for shop list/detail (`shopProductCompatibility.service`)
- Secure POS + tenant isolation patterns for commerce routes
- Dev Dashboard–first onboarding via POS Integration

### Current gaps and risks

- **No user-facing orders list API** or Home “recent orders” (data exists in `order_references`)
- **Sync** — retry/backoff and production hardening for rate limits / very large catalogs
- **PDP** — multi-variant and related products not built
- **Observability** — no consolidated sync/webhook/cart health in admin (Milestone 0.6)
- **Pilot QA** — Milestone 6 checklist not formally closed

## Milestone 0: Security Hardening

Commerce build does not proceed until this milestone is complete.

**Status:** Largely implemented; **observability (0.6)** and deeper operational polish remain.

### 0.1 Encrypt Shopify secrets at rest

- Add a dedicated crypto utility using `ENCRYPTION_KEY`
- Encrypt before persisting:
  - `shopify_client_secret`
  - `shopify_storefront_token` (optional storefront phase)
  - `shopify_webhook_secret`
- Decrypt only inside backend code paths that need the secret
- Add a safe migration/backfill strategy for any existing plaintext tenant secrets

**Implemented:**
- Added encrypted tenant secret helpers
- Updated secure POS config writes to encrypt stored Shopify values
- Updated Shopify integration paths to decrypt only at point of use
- Preserved compatibility with legacy plaintext values during rollout

### 0.2 Remove secret exposure from admin flows

- Never return raw Shopify secrets from create/update APIs after save
- Replace returned values with booleans like `clientSecretConfigured`, `storefrontTokenConfigured`, and `webhookSecretConfigured`
- Audit logs, error payloads, and debug output so secrets cannot leak through failures

**Implemented:**
- POS summary APIs now return configured-state booleans rather than raw secrets
- Super Admin and Retailer Admin secret fields are now write-only replacement inputs
- Reveal/show behavior was removed from Shopify secret UI fields

### 0.3 Harden tenant isolation

- Ensure all commerce endpoints derive tenant from trusted middleware, not request body values
- Ensure Shopify shop-domain matching is strict and normalized
- Prevent any cross-tenant product, cart, order, or webhook access paths

**Implemented in this phase:**
- Retailer-admin POS endpoints are tenant-derived from authenticated tenant context rather than URL-selected tenant IDs
- Shared POS config service is reused across admin surfaces to reduce drift

**Required for Dev Dashboard rollout:**
- Normalize and persist canonical `{shop}.myshopify.com` per tenant
- On connection test, verify returned Shopify shop domain matches tenant-configured domain
- Reject mismatched shop domain saves and webhook processing

### 0.4 Make webhook processing safe

- Keep HMAC verification as the first gate
- Add idempotency for duplicate webhook deliveries
- Persist webhook receipt metadata so repeated deliveries do not duplicate order effects
- Log webhook verification and processing failures with enough context for support, but never secrets

**Implemented:**
- Webhook verification uses a shared HMAC helper (`verifyShopifyWebhookRequest`) for `orders/create` and catalog topics
- **`shopify_webhook_receipts`** + **`X-Shopify-Webhook-Id`** dedupe **catalog** topics and **`orders/create`** (`tryInsertShopifyWebhookReceipt` in `shopifyWebhook.controller` / catalog controller)

### 0.5 Minimize Shopify scopes

- Review Storefront API scopes and keep only what mobile cart and checkout need
- Review Admin API scopes and keep only what sync and webhook-related workflows need
- **Canonical OAuth scope list:** [CREATING-A-NEW-TENANT.md §9.2](./CREATING-A-NEW-TENANT.md#92-required-shopify-access) (Admin, Storefront, future loyalty)
- Document the required TAB Shopify app configuration clearly for future tenants
- Keep the current merchant-side setup narrow while we evaluate whether later commerce milestones justify a Partner/CLI-managed app

### 0.6 Add observability

- Track:
  - last successful sync
  - last sync error
  - last successful webhook
  - last webhook failure
  - cart mutation failures
- Expose a simple internal health summary in admin or super admin

**Still outstanding.**

### 0.7 Implement Dev Dashboard credential onboarding

- POS Integration in Super Admin and Retailer Admin must support:
  - `shopify_store_url`
  - `shopify_client_id`
  - `shopify_client_secret` (write-only)
  - `shopify_storefront_token` (optional)
  - `shopify_webhook_secret` (write-only)
- Replace static Admin token dependency with runtime client-credentials exchange
- Cache short-lived tokens server-side with safe expiry buffer
- Keep all credential handling tenant-scoped and encrypted

**Implemented:** POS fields above; client-credentials path; optional Storefront token + auto-provision for Partner apps.

## Milestone 1: Commerce Backend Foundation

Build a safe backend foundation before exposing customer purchase flows.

**Status:** Mostly implemented; sync hardening and customer **orders read** API remain.

### 1.1 Harden Shopify product sync

- Add pagination beyond the current single-page fetch
- Add retry/backoff for rate limiting
- Reconcile archived or removed products
- Preserve mapping state where possible across syncs
- Validate behavior against a real TAB-sized catalog

**Implemented:** Cursor **`page_info`** pagination and batched import paths in `shopifyAdapter.ts`; encrypted Admin credentials.

**Still outstanding:** **retry/backoff** for throttling/transients; deeper **archived reconciliation** and **large-catalog** validation.

### 1.2 Normalize Storefront variant identifiers

- Define the canonical source for Storefront variant GIDs
- Ensure every purchasable app product has a valid Storefront `merchandiseId`
- Reject add-to-cart operations for products lacking valid Storefront mapping

**Implemented:** `toStorefrontVariantGid` / `storefrontVariantGid.ts`; cart service rejects invalid mapping; POS variant id stored on `pos_products`.

### 1.3 Persist order references

- Finish the `orders/create` webhook flow
- Store:
  - tenant
  - matched user
  - Shopify order ID
  - order number
  - totals
  - placed timestamp
  - source
- Make webhook-backed `order_references` the authoritative basis for recent orders and later analytics

**Implemented:** Migration `order_references`; `upsertOrderReference` from `orders/create` (email → user match). **Still open:** enrich row with totals/timestamps from payload if needed for UI; **authenticated read API** for the app.

### 1.4 Finalize read APIs for commerce surfaces

- `GET /products`
- `GET /products/compatible/:spaProfileId`
- category metadata endpoint if needed
- product detail endpoint with variants, inventory, pricing, images, and compatibility context

**Implemented (customer-facing):** `GET /products/shop`, `.../shop/categories`, `.../shop/price-bounds`, product detail fetch used by mobile (compat + spa query). Exact paths differ from original bullet names; behavior is covered.

**Partial:** No dedicated **multi-variant** breakdown on PDP API if Shopify has multiple variants (mobile assumes default purchasable variant).

### 1.5 Runtime token exchange for Admin API

- Add a dedicated token provider that exchanges:
  - `shopify_client_id`
  - `shopify_client_secret`
  against:
  - `POST https://{shop}.myshopify.com/admin/oauth/access_token`
- Cache tokens per tenant in memory with proactive refresh
- Ensure sync and connection tests use runtime-exchanged token paths only

**Implemented:** `getTenantShopifyAdminAccessToken` + cache; legacy admin token fallback still supported.

## Milestone 2: Read-Only Shop Experience

Ship the safest customer-facing commerce slice first.

**Status:** Shipped for browse + buy path; **multi-spa selector** and PDP gaps below remain.

### 2.1 Shop tab

- Compatible mode as default
- Browse-all mode
- Search
- Category filter pills
- Paginated or infinite-scroll product list (single-column rows with add-to-cart on mobile)

### 2.2 Product detail page

- Image carousel
- Price and compare-at price
- Variant selection — **not implemented** (default purchasable variant)
- Inventory state
- Compatibility badge
- Related products — **not implemented**

### 2.3 Multi-spa selector

- Add active spa selection to Home and Shop
- Persist active spa context locally
- Make Shop results explicitly depend on the active spa

**Not implemented:** Shop uses **primary** spa profile from `/spa-profiles`, not a user-selected active spa persisted on device.

## Milestone 3: Cart Service

Add Storefront-backed cart behavior after browsing is stable.

**Status:** Implemented (server-side cart id per user + Storefront API proxy).

### 3.1 Cart abstraction

- Introduce a dedicated cart service in mobile
- Store cart ID in secure local storage
- Tie cart to tenant and user context

### 3.2 Cart operations

- Create cart
- Fetch cart
- Add lines
- Update quantities
- Remove lines

### 3.3 Cart safeguards

- Never trust client-computed totals
- Always use Shopify's returned cart state after mutations
- Handle:
  - invalid variants
  - out-of-stock products
  - stale carts
  - products removed from retailer catalog

## Milestone 4: Checkout Kit Integration

Use Shopify's native checkout surface rather than building our own.

**Status:** Implemented; polish **completion states** (4.2) as needed.

### 4.1 Checkout flow

- Preload checkout when cart is ready
- Launch Checkout Kit from the cart screen
- Keep all payment entry inside Shopify's native sheet

### 4.2 Completion states

- `completed`: show success flow, then reconcile against webhook/order reference
- `cancelled`: keep cart intact
- `failed`: show retry path and preserve cart state

### 4.3 Reconciliation

- Do not treat client-side checkout completion as the only source of truth
- Prefer webhook-confirmed order creation for final success state and recent orders

## Milestone 5: Home and Order Experience Completion

Tie commerce into the rest of the customer experience.

**Status:** **5.1** done (Recent orders card + read API). **5.3** done (push on order when user matched by email). **5.2** other home cards (warranty, filters, seasonal) remain product/config follow-ups.

### 5.1 Recent orders card

- Backed by `order_references`
- User-scoped and tenant-scoped
- Shows on Home once order flow is reliable

### 5.2 Home info cards

- Warranty card
- Filter reminder
- Seasonal alert
- Recent orders

### 5.3 Order notifications

- Confirm order messages from verified webhook-backed data
- Keep notification content simple and trustworthy

**Implemented:** `orders/create` → `upsertOrderReference` → optional **push** to matched `users` row by email (`notification.service`).

## Milestone 6: TAB Pilot Hardening

Before broad rollout, validate against real TAB data and real operating conditions.

**Status:** Code and audit checklist ready; **formal execution** still required before broad customer rollout (see `docs/phase3-catalog-qa-playbook.md` and `docs/zero-trust-commerce-audit-2026-04-02.md`).

### 6.1 Real catalog QA

- Large catalog pagination
- Variant correctness
- Hidden product behavior
- Out-of-stock behavior
- Rich descriptions
- Compare-at pricing

### 6.2 Failure-path QA

- Invalid Storefront variant GID
- Expired cart
- Duplicate webhook delivery
- Webhook arriving later than client completion event
- Shopify downtime or rate limiting
- Partial sync failures

### 6.3 Security review

- Secret storage
- Endpoint authorization
- Tenant isolation
- Webhook replay/idempotency
- Logging and sensitive data exposure

## Recommended Delivery Order

1. ~~Security hardening~~ ✓ (ongoing: observability)
2. ~~Dev Dashboard credential onboarding + runtime token exchange~~ ✓
3. ~~Order reference persistence~~ ✓; **product sync hardening** (retry/QA) — in progress
4. ~~Read-only shop + cart + checkout~~ ✓ (PDP variants / related — optional)
5. ~~**Home/order completion**~~ — orders read API + Home card ✓
6. **TAB pilot QA and hardening** — run scripted matrix + sign zero-trust audit

## Must-Complete Before TAB Pilot

- Shopify secrets encrypted at rest ✓
- Admin APIs do not expose raw credentials ✓
- Webhook idempotency implemented ✓ (catalog + `orders/create`)
- Full-catalog sync pagination implemented ✓ (`page_info` cursors)
- Reliable Storefront variant mapping defined ✓ (GID helper + cart validation)
- `order_references` persisted from webhook ✓
- Read-only shop verified against real TAB catalog — **QA (Milestone 6)**
- Cart and checkout tested with real tenant data — **QA (Milestone 6)**
- **User-visible order history** — **read API + Home card** ✓ (pilot QA still required)

## Can Ship in Early Internal Beta

- Read-only shop + cart + checkout (current mobile path)
- PDP (single-variant assumption)
- Product filtering by compatibility and category
- Multi-spa selector — **persisted active spa** for Shop (see `ActiveSpaProvider`)

## Should Wait Until Post-Pilot or Later Phase 3

- Subscription engine
- Bundle purchasing
- Referral purchase attribution
- Commerce-driven advanced analytics

## Definition of Done for Phase 3 Commerce

Commerce is not done until all of the following are true:

- Customers can browse compatible and browse-all products safely ✓
- PDPs show accurate **prices, inventory, and compatibility** ✓; **multi-variant accuracy** only if catalog requires it (currently default variant)
- Cart create/update/remove works against real Shopify Storefront data ✓
- Checkout launches through Shopify Checkout Kit ✓
- Successful orders are reconciled through verified webhook handling ✓ (`order_references` + idempotency)
- `order_references` persist correctly ✓
- **Recent orders UI works from authoritative backend data** — **not done** (no read API / Home card)
- Shopify secrets are encrypted at rest ✓
- Sync handles full retailer catalog size with **pagination** ✓; **retry behavior** still recommended for production
- Tenant isolation and webhook safety have been explicitly tested — **Milestone 6**
