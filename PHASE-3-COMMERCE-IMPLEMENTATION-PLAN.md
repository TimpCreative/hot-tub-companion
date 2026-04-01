# Phase 3 Commerce Implementation Plan

This document turns the Phase 3 commerce roadmap into a practical implementation plan, starting with security hardening for Take A Break's live Shopify integration.

## Status Review

### Implemented

- Shopify Admin and Storefront tenant secrets are now encrypted at rest
- Shopify secrets are decrypted only at point of use in backend integration paths
- POS config APIs now return non-secret summary/configured-state values instead of raw tokens
- Shared tenant POS config service exists for secure load/update/test flows
- Retailer Admin Settings now includes a POS Integration section
- Super Admin and Retailer Admin both use write-only token replacement UX
- Stored tokens are no longer revealable in the admin UI

### Partial

- Existing plaintext compatibility is preserved in code paths so current tenants do not break if legacy values exist
- Webhook verification uses decrypted secret values, but webhook idempotency and receipt tracking are still outstanding
- Product sync security is improved through secret handling, but sync pagination/retry hardening is still outstanding

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
3. Admin tokens never reach the mobile app.
4. Every commerce operation is tenant-scoped and server-verified.
5. Webhooks are authoritative for order confirmation and reconciliation.
6. Security hardening happens before cart and checkout work.

## Current State

### Already in place

- Shopify Admin product sync exists in the backend
- `orders/create` webhook verification exists with HMAC validation
- Product compatibility and visibility systems already exist
- Mobile app has the shell for Shop but not the commerce UI
- Phase 3 content work is already partially shipped, so commerce is the biggest remaining Phase 3 workstream
- Secure tenant secret handling and admin POS management foundations are now implemented

### Current gaps and risks

- Webhook handling does not yet persist `order_references`
- Product sync is still intentionally simple and does not appear production-hardened for large retailer catalogs
- Storefront cart and Checkout Kit flows are not yet implemented
- Variant mapping to Storefront GIDs needs to be made explicit and reliable
- Webhook idempotency and receipt tracking are still not implemented

## Milestone 0: Security Hardening

Commerce build does not proceed until this milestone is complete.

**Status:** Implemented, with follow-up work still open for webhook idempotency and deeper observability.

### 0.1 Encrypt Shopify secrets at rest

- Add a dedicated crypto utility using `ENCRYPTION_KEY`
- Encrypt before persisting:
  - `shopify_storefront_token`
  - `shopify_admin_token`
  - `shopify_webhook_secret`
- Decrypt only inside backend code paths that need the secret
- Add a safe migration/backfill strategy for any existing plaintext tenant secrets

**Implemented:**
- Added encrypted tenant secret helpers
- Updated secure POS config writes to encrypt stored Shopify values
- Updated Shopify integration paths to decrypt only at point of use
- Preserved compatibility with legacy plaintext values during rollout

### 0.2 Remove secret exposure from admin flows

- Never return raw Shopify tokens from create/update APIs after save
- Replace returned values with booleans like `storefrontTokenConfigured` and `adminTokenConfigured`
- Audit logs, error payloads, and debug output so tokens cannot leak through failures

**Implemented:**
- POS summary APIs now return configured-state booleans rather than raw secrets
- Super Admin and Retailer Admin token fields are now write-only replacement inputs
- Reveal/show behavior was removed from the admin token UI

### 0.3 Harden tenant isolation

- Ensure all commerce endpoints derive tenant from trusted middleware, not request body values
- Ensure Shopify shop-domain matching is strict and normalized
- Prevent any cross-tenant product, cart, order, or webhook access paths

**Implemented in this phase:**
- Retailer-admin POS endpoints are tenant-derived from authenticated tenant context rather than URL-selected tenant IDs
- Shared POS config service is reused across admin surfaces to reduce drift

### 0.4 Make webhook processing safe

- Keep HMAC verification as the first gate
- Add idempotency for duplicate webhook deliveries
- Persist webhook receipt metadata so repeated deliveries do not duplicate order effects
- Log webhook verification and processing failures with enough context for support, but never secrets

**Implemented:**
- Webhook verification now uses decrypted secret values at point of use

**Still outstanding:**
- duplicate-delivery idempotency
- webhook receipt persistence

### 0.5 Minimize Shopify scopes

- Review Storefront API scopes and keep only what mobile cart and checkout need
- Review Admin API scopes and keep only what sync and webhook-related workflows need
- Document the required TAB Shopify app configuration clearly for future tenants

### 0.6 Add observability

- Track:
  - last successful sync
  - last sync error
  - last successful webhook
  - last webhook failure
  - cart mutation failures
- Expose a simple internal health summary in admin or super admin

**Still outstanding.**

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
2. Product sync hardening and order reference persistence
3. Read-only shop experience
4. Cart service
5. Checkout Kit integration
6. Home/order completion
7. TAB pilot QA and hardening

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
