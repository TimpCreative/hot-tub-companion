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

### Implemented

- Shopify tenant secrets are encrypted at rest
- Shopify secrets are decrypted only at point of use in backend integration paths
- POS config APIs now return non-secret summary/configured-state values instead of raw tokens
- Shared tenant POS config service exists for secure load/update/test flows
- Retailer Admin Settings now includes a POS Integration section
- Super Admin and Retailer Admin both use write-only token replacement UX
- Stored secrets are no longer revealable in the admin UI
- Dev Dashboard-first onboarding is now the required model for new tenant Shopify connections

### Partial

- Existing plaintext compatibility is preserved in code paths so current tenants do not break if legacy values exist
- Product sync pagination/retry hardening for very large catalogs is still outstanding

### Recently added (catalog freshness)

- **`products/update`** and **`inventory_levels/update`** webhooks with HMAC verification; idempotency via `shopify_webhook_receipts` and `X-Shopify-Webhook-Id`
- Per-tenant **`shopify_catalog_sync_enabled`** toggle; webhook registration/removal on enable/disable; requires **`PUBLIC_API_URL`** for callback addresses
- Internal cron: **`POST /api/v1/internal/cron/sync-shopify-catalog`** (with **`CRON_SECRET`**) for incremental `updated_at_min` pulls; throttled by **`product_sync_interval_minutes`**
- Retailer **full catalog import** and sync APIs moved to **`/api/v1/admin/settings/pos/sync/*`** with **`can_manage_settings`**

### Not Yet Started

- Storefront cart and Checkout Kit implementation
- `order_references` persistence
- Storefront variant GID normalization
- Read-only Shop experience
- Home recent orders and commerce cards
- TAB pilot QA and catalog hardening

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

- Shopify Admin product sync exists in the backend
- `orders/create` webhook verification exists with HMAC validation
- Product compatibility and visibility systems already exist
- Mobile app has the shell for Shop but not the commerce UI
- Phase 3 content work is already partially shipped, so commerce is the biggest remaining Phase 3 workstream
- Secure tenant secret handling and admin POS management foundations are now implemented
- Current onboarding is Dev Dashboard-first and tenant-scoped through POS Integration in Super Admin/Retailer Admin

### Current gaps and risks

- Webhook handling does not yet persist `order_references`
- Product sync is still intentionally simple and does not appear production-hardened for large retailer catalogs
- Storefront cart and Checkout Kit flows are not yet implemented
- Variant mapping to Storefront GIDs needs to be made explicit and reliable
- Webhook idempotency and receipt tracking are still not implemented
- Runtime credential exchange and strict tenant shop-domain validation still need to be completed end-to-end

## Milestone 0: Security Hardening

Commerce build does not proceed until this milestone is complete.

**Status:** Implemented, with follow-up work still open for webhook idempotency and deeper observability.

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
- Catalog webhooks (`products/update`, `inventory_levels/update`) record **`X-Shopify-Webhook-Id`** in **`shopify_webhook_receipts`** to skip duplicates

**Still outstanding:**
- Extend the same idempotency pattern to **`orders/create`** if duplicate order notifications become an issue

### 0.5 Minimize Shopify scopes

- Review Storefront API scopes and keep only what mobile cart and checkout need
- Review Admin API scopes and keep only what sync and webhook-related workflows need
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

## Milestone 1: Commerce Backend Foundation

Build a safe backend foundation before exposing customer purchase flows.

**Status:** Partially implemented.

### 1.1 Harden Shopify product sync

- Add pagination beyond the current single-page fetch
- Add retry/backoff for rate limiting
- Reconcile archived or removed products
- Preserve mapping state where possible across syncs
- Validate behavior against a real TAB-sized catalog

**Implemented:**
- Sync now reads encrypted Admin credentials safely

**Still outstanding:**
- pagination
- retry/backoff
- reconciliation for archived/removed products
- large-catalog validation

### 1.2 Normalize Storefront variant identifiers

- Define the canonical source for Storefront variant GIDs
- Ensure every purchasable app product has a valid Storefront `merchandiseId`
- Reject add-to-cart operations for products lacking valid Storefront mapping

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

**Not yet implemented.**

### 1.4 Finalize read APIs for commerce surfaces

- `GET /products`
- `GET /products/compatible/:spaProfileId`
- category metadata endpoint if needed
- product detail endpoint with variants, inventory, pricing, images, and compatibility context

**Not yet implemented.**

### 1.5 Runtime token exchange for Admin API

- Add a dedicated token provider that exchanges:
  - `shopify_client_id`
  - `shopify_client_secret`
  against:
  - `POST https://{shop}.myshopify.com/admin/oauth/access_token`
- Cache tokens per tenant in memory with proactive refresh
- Ensure sync and connection tests use runtime-exchanged token paths only

## Milestone 2: Read-Only Shop Experience

Ship the safest customer-facing commerce slice first.

### 2.1 Shop tab

- Compatible mode as default
- Browse-all mode
- Search
- Category filter pills
- Paginated or infinite-scroll product grid

### 2.2 Product detail page

- Image carousel
- Price and compare-at price
- Variant selection
- Inventory state
- Compatibility badge
- Related products

### 2.3 Multi-spa selector

- Add active spa selection to Home and Shop
- Persist active spa context locally
- Make Shop results explicitly depend on the active spa

## Milestone 3: Cart Service

Add Storefront-backed cart behavior after browsing is stable.

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

## Milestone 6: TAB Pilot Hardening

Before broad rollout, validate against real TAB data and real operating conditions.

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

1. Security hardening
2. Dev Dashboard credential onboarding + runtime token exchange
3. Product sync hardening and order reference persistence
4. Read-only shop experience
5. Cart service
6. Checkout Kit integration
7. Home/order completion
8. TAB pilot QA and hardening

## Must-Complete Before TAB Pilot

- Shopify secrets encrypted at rest
- Admin APIs do not expose raw credentials
- Webhook idempotency implemented
- Full-catalog sync pagination implemented
- Reliable Storefront variant mapping defined
- `order_references` persisted from webhook
- Read-only shop verified against real TAB catalog
- Cart and checkout tested with real tenant data

**Completed so far:**
- Shopify secrets encrypted at rest
- Admin APIs do not expose raw credentials

## Can Ship in Early Internal Beta

- Read-only shop
- PDP
- Multi-spa selector for Home/Shop
- Product filtering by compatibility and category

## Should Wait Until Post-Pilot or Later Phase 3

- Subscription engine
- Bundle purchasing
- Referral purchase attribution
- Commerce-driven advanced analytics

## Definition of Done for Phase 3 Commerce

Commerce is not done until all of the following are true:

- Customers can browse compatible and browse-all products safely
- PDPs show accurate variants, prices, inventory, and compatibility
- Cart create/update/remove works against real Shopify Storefront data
- Checkout launches through Shopify Checkout Kit
- Successful orders are reconciled through verified webhook handling
- `order_references` persist correctly
- Recent orders UI works from authoritative backend data
- Shopify secrets are encrypted at rest
- Sync handles full retailer catalog size with pagination and retry behavior
- Tenant isolation and webhook safety have been explicitly tested
