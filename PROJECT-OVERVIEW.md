# Hot Tub Companion — Project Overview & Phase Guide

**Project:** Hot Tub Companion (White-Label Mobile App Platform for Spa Retailers)
**Client:** TimpCreative (internal build)
**Platform URL:** HotTubCompanion.com
**Launch Partner:** Take A Break Spas & Billiards (Springville, UT)

---

## What This Document Is

This is the master reference for building Hot Tub Companion. The project is broken into 7 phases (0–6), each with its own detailed spec file. This document explains how the phases connect, what depends on what, and provides the global context that every phase file assumes you understand.

Read this document FIRST before opening any phase file.

---

## Project Summary

Hot Tub Companion is a white-labeled mobile app platform. Spa/hot tub retailers sign a contract with TimpCreative to receive their own branded version of the app, published separately on App Store and Google Play. Customers download their retailer's app, register their spa, and use it to buy supplies, schedule service, manage subscriptions, track water care, and access guides — all personalized to their specific hot tub model and sanitization system.

TimpCreative manages a single multi-tenant backend that powers all retailer apps. Each retailer gets a web-based admin dashboard at `[retailername].hottubcompanion.com`. TimpCreative operates a super admin dashboard at `admin.hottubcompanion.com`.

---

## Tech Stack (Global)

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Mobile App** | React Native + Expo | Single codebase, white-labeled per retailer via `app.config.js` + environment variables. Each retailer = separate App Store/Play Store listing with unique bundle ID. |
| **Backend API** | Node.js / Express | RESTful API, multi-tenant. All requests include tenant identification via API key or subdomain. |
| **Database** | PostgreSQL | Hosted on Railway (initial). All tables include `tenant_id` for data isolation. |
| **Auth** | Firebase Authentication | Email/password for customers. Email/password + role-based for retailer staff. |
| **Push Notifications** | Firebase Cloud Messaging (FCM) | Routed through backend for scheduled/triggered notifications. |
| **File Storage** | Firebase Storage | Retailer branding assets, content media, product images (cached from POS). |
| **Hosting** | Railway (Pro plan) | Node.js API + PostgreSQL. Usage-based pricing. Migrate to AWS when scaling demands it. |
| **Retailer Dashboard** | Next.js (React) | Web app at `[retailer].hottubcompanion.com`. Subdomain routing for multi-tenant. |
| **Super Admin Dashboard** | Next.js (React) | Web app at `admin.hottubcompanion.com`. Shares component library with retailer dashboard. |
| **POS Integration** | Shopify Storefront API + Admin API (primary), Lightspeed X-Series API | Product sync, cart/checkout, order routing, subscriptions. |
| **Checkout** | Shopify Checkout Kit for React Native (`@shopify/checkout-sheet-kit`) | Native checkout sheet within the app. Shopify handles all payment processing. TimpCreative never stores card data. |
| **Fuzzy Matching** | Fuse.js | Product-to-UHTD mapping recommendations in admin dashboard. |
| **Email** | SendGrid | Transactional emails (order confirmations, service request notifications, account management). |

---

## Architecture Principles

1. **Multi-tenant, single codebase.** One backend serves all retailers. Data is isolated by `tenant_id`. Features are toggled per tenant via configuration, not code branches.

2. **We don't touch money.** All payments route through the retailer's Shopify/POS. We use Shopify Storefront API to build carts and Shopify Checkout Kit to present a native checkout sheet. We never store credit card numbers, process transactions, or handle PCI compliance.

3. **The retailer's POS is the source of truth for products.** We sync from their POS, never the other way around. If they want to change a price or add a product, they do it in their POS. Our app reflects those changes via sync.

4. **The UHTD (Universal Hot Tub Database) is our source of truth for compatibility.** It maps spa models to compatible parts. The mapping tool connects retailer POS SKUs to UHTD entries, enabling personalized product recommendations.

5. **White-labeling is config, not code.** Each retailer's app is built from the same React Native codebase. Branding (colors, logos, fonts, app name, icon) and feature flags are injected at build time via environment variables and `app.config.js`. At runtime, the app fetches tenant configuration from the API.

6. **Retailers control their own experience.** Features can be toggled on/off per contract. Content can be retailer-provided or universal. Service types are retailer-defined. Subscription bundles are retailer-configurable.

7. **The customer home screen is modular and dealer-owned.** The "My Tub" home screen should be built as a configurable set of widgets (cards/sections) so each dealer can customize what appears (and in what order), including dealer-specific widgets that integrate their own systems and processes to make the app feel like *theirs*.

---

## Data Model Overview (Simplified)

These are the core entities. Each phase file contains detailed schemas for the tables it introduces.

### Tenant (Retailer)
- `id`, `name`, `slug` (for subdomain), branding config (colors, logos, fonts), feature flags, POS connection credentials, Shopify store URL, fulfillment preference, contract details.

### User (Customer)
- `id`, `tenant_id`, `email`, `name`, `phone`, `address`, Firebase UID, notification preferences, loyalty points, referral code.

### Spa Profile
- `id`, `user_id`, `tenant_id`, `brand`, `model_line`, `model`, `year`, `sanitization_system` (enum: bromine, chlorine, frog_ease, copper, silver_mineral), `serial_number`, `usage_months` (array of months tub is in use), `created_at`.

### UHTD Spa Model
- `id`, `brand`, `model_line`, `model`, `year_start`, `year_end`, `water_capacity_gallons`, `filter_type`, `jet_count`, `seating`, `dimensions`, `is_discontinued`.

### UHTD Compatibility Mapping
- `id`, `spa_model_id`, `part_category` (filter, cover, chemical, headrest, jet, pump, etc.), `compatible_product_identifier` (generic part number or description), `notes`.

### POS Product (synced from retailer)
- `id`, `tenant_id`, `pos_product_id` (external ID from Shopify/Lightspeed), `title`, `description`, `price`, `images`, `inventory_quantity`, `variants`, `is_hidden` (soft-hide by retailer), `last_synced_at`.

### Product-UHTD Map
- `id`, `tenant_id`, `pos_product_id`, `uhtd_compatibility_id`, `mapped_by` (user who confirmed), `confidence_score`, `is_confirmed`.

### Water Test Log
- `id`, `spa_profile_id`, `user_id`, `tenant_id`, `ph`, `alkalinity`, `sanitizer_level`, `calcium_hardness`, `temperature`, `notes`, `tested_at`, `shared_with_retailer` (boolean).

### Service Request
- `id`, `user_id`, `tenant_id`, `spa_profile_id`, `service_type` (configured per tenant), `category` (water_valet | technician), `description`, `preferred_date`, `status` (pending, confirmed, completed, cancelled), `retailer_notes`, `created_at`.

### Subscription
- `id`, `user_id`, `tenant_id`, `spa_profile_id`, managed_by (shopify | internal), `shopify_subscription_id` (nullable), `items` (JSON array of product + quantity), `frequency`, `next_delivery_date`, `status` (active, paused, cancelled), `pause_reason`, `discount_percentage`.

### Content
- `id`, `tenant_id` (nullable for universal content), `title`, `type` (article | video), `body` (for articles), `video_url` (YouTube link for videos), `target_brands` (array), `target_sanitization_systems` (array), `target_models` (array), `is_universal`, `priority` (retailer content > universal), `published_at`.

### Notification
- `id`, `tenant_id`, `target` (all_users | specific_user | segment), `title`, `body`, `type` (maintenance | order | subscription | service | promotional), `scheduled_for`, `sent_at`, `created_by`.

---

## Phase Dependency Map

```
Phase 0: Foundation
  └─► Phase 1: Core Data Layer (depends on Phase 0 database schema)
       ├─► Phase 2: Customer App MVP (depends on Phase 1 product data + UHTD)
       │    └─► Phase 3: Engagement Features (depends on Phase 2 app shell)
       │         └─► Phase 4: Services & Communication (depends on Phase 3)
       │              └─► Phase 5: Growth Features (depends on Phase 4)
       │                   └─► Phase 6: Scale & Polish (depends on Phase 5)
       │
       └─► UHTD Data Entry (parallel track, ongoing from Phase 1 onward)
```

**What can run in parallel:**
- UHTD data population can happen manually alongside any phase after Phase 1
- Retailer dashboard and mobile app can be developed simultaneously within a phase
- Content creation (guides, tutorials) can begin during Phase 2+

**What CANNOT be parallelized:**
- Phase 0 must complete before anything else
- Phase 1 POS integration must work before Phase 2 e-commerce
- Phase 2 app must be functional before Phase 3 adds features on top

---

## White-Label Build System

Each retailer app is a configured build of the same codebase. Here's how it works:

### Build-Time Configuration (app.config.js)
```
TENANT_SLUG=takeabreak
APP_NAME=Take A Break Spas
BUNDLE_ID=com.hottubcompanion.takeabreak
APP_ICON=./tenants/takeabreak/icon.png
SPLASH_IMAGE=./tenants/takeabreak/splash.png
API_URL=https://api.hottubcompanion.com
TENANT_API_KEY=tab_live_xxxxxxxxxxxx
```

### Runtime Configuration (fetched from API on app launch)
```json
{
  "tenant_id": "tab-001",
  "branding": {
    "primary_color": "#1B4D7A",
    "secondary_color": "#E8A832",
    "font_family": "Montserrat",
    "logo_url": "https://storage.hottubcompanion.com/tenants/takeabreak/logo.png"
  },
  "features": {
    "subscriptions": true,
    "loyalty_program": true,
    "referral_program": false,
    "water_care_assistant": true,
    "service_scheduling": true
  },
  "service_types": [
    { "id": "water_valet", "name": "Water Valet", "category": "water_valet", "description": "Chemical maintenance and filter changes" },
    { "id": "repair", "name": "Hot Tub Repair", "category": "technician", "description": "Factory-trained technician for repairs" },
    { "id": "delivery", "name": "Delivery & Setup", "category": "technician", "description": "Hot tub delivery and installation" }
  ],
  "sanitization_systems": ["bromine", "chlorine", "frog_ease", "copper", "silver_mineral"],
  "fulfillment_mode": "self",
  "shopify_store_url": "takeabreakspas.myshopify.com"
}
```

### Tenant Directory Structure
```
/tenants
  /takeabreak
    /icon.png
    /splash.png
    /adaptive-icon.png
    /config.env
  /retailer-two
    /icon.png
    /splash.png
    /adaptive-icon.png
    /config.env
```

### Build Commands
```bash
# Build for specific retailer
TENANT=takeabreak eas build --platform ios --profile production
TENANT=takeabreak eas build --platform android --profile production

# Build all retailers
./scripts/build-all.sh --platform all --profile production
```

---

## Sanitization Systems Reference

These are the chemical-based sanitization systems customers select during onboarding. These are NOT hardware features (ozone, UV are built into the tub and captured in the UHTD model data).

| System | Key | Description |
|--------|-----|-------------|
| Bromine | `bromine` | Tablet or granular bromine-based sanitization |
| Chlorine | `chlorine` | Granular dichlor or liquid chlorine |
| Frog @Ease | `frog_ease` | SmartChlor mineral cartridge system |
| Copper | `copper` | Copper ionizer-based sanitization |
| Silver/Mineral Stick | `silver_mineral` | Silver ion mineral purifier stick |

These values are used to:
- Filter product recommendations (customer only sees chemicals compatible with their system)
- Filter content/guides (customer sees guides specific to their sanitization approach)
- Drive subscription bundle recommendations

---

## Retailer Onboarding Process (High-Level)

1. Contract signed → features, pricing, fulfillment preference agreed
2. Admin dashboard provisioned → `[retailer].hottubcompanion.com`
3. Branding package collected → logos, colors, fonts, app icon, splash screen
4. POS/Shopify connection established via admin dashboard
5. Product catalog initial sync
6. Product → UHTD mapping (collaborative, fuzzy matching assisted)
7. Feature configuration → toggle subscriptions, referrals, loyalty, service types, etc.
8. Content setup → retailer provides custom content; TimpCreative fills gaps
9. App build & submission → branded app built, tested, submitted to stores
10. QA & soft launch → retailer tests with internal team
11. Go live → app published, retailer begins customer onboarding

Estimated time per retailer: ~30 days

---

## File Index

| File | Phase | Description |
|------|-------|-------------|
| `PHASE-0-FOUNDATION.md` | Phase 0 | Backend scaffold, database schema, auth, React Native project, white-label system, admin dashboard shells |
| `PHASE-1-CORE-DATA.md` | Phase 1 | UHTD schema + initial data, POS/Shopify integration, product sync, mapping tool |
| `PHASE-2-CUSTOMER-MVP.md` | Phase 2 | Customer app: onboarding, spa registration, My Tub dashboard, product browsing, Shopify checkout, basic push notifications |
| `PHASE-3-ENGAGEMENT.md` | Phase 3 | Water Care Assistant, seasonal maintenance timeline, content system, subscription management |
| `PHASE-4-SERVICES-COMMS.md` | Phase 4 | Service request system, retailer scheduling integration, retailer ↔ TimpCreative inbox, urgent banner system, retailer push notification scheduling |
| `PHASE-5-GROWTH.md` | Phase 5 | Loyalty/rewards program, referral program, analytics dashboards (retailer + super admin), recommended bundles, subscription discounts |
| `PHASE-6-SCALE-POLISH.md` | Phase 6 | Data export/import, new owner onboarding flow, multi-spa refinements, second retailer onboarding, AWS migration planning |

---

## Conventions

- **All API endpoints** are prefixed with `/api/v1/`
- **All tenant-scoped endpoints** include tenant identification via `x-tenant-key` header or subdomain extraction
- **All database tables** with tenant-scoped data include a `tenant_id` column with a foreign key to `tenants`
- **All timestamps** are stored in UTC as ISO 8601
- **All monetary values** are stored as integers in cents (e.g., $29.99 = 2999)
- **All IDs** use UUIDs unless interfacing with external systems (Shopify IDs, Lightspeed IDs remain as their native type)
- **Environment variables** use `UPPER_SNAKE_CASE`
- **Database columns** use `snake_case`
- **API request/response bodies** use `camelCase`
- **React components** use `PascalCase`
- **File names** use `kebab-case` for non-component files, `PascalCase` for component files

---

## Key API Endpoints Preview

This is not exhaustive — each phase file contains the full endpoint spec for its features. This is to show the shape of the API.

```
# Auth
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/forgot-password

# Tenant Config (public, used by app on launch)
GET    /api/v1/tenant/config

# Spa Profiles
POST   /api/v1/spa-profiles
GET    /api/v1/spa-profiles
GET    /api/v1/spa-profiles/:id
PUT    /api/v1/spa-profiles/:id
DELETE /api/v1/spa-profiles/:id

# Products (filtered by tenant + spa compatibility)
GET    /api/v1/products
GET    /api/v1/products/:id
GET    /api/v1/products/compatible/:spaProfileId

# Cart & Checkout (Shopify-backed)
POST   /api/v1/cart/create
POST   /api/v1/cart/add
POST   /api/v1/cart/update
DELETE /api/v1/cart/remove
GET    /api/v1/cart
GET    /api/v1/cart/checkout-url

# Subscriptions
GET    /api/v1/subscriptions
POST   /api/v1/subscriptions
PUT    /api/v1/subscriptions/:id
POST   /api/v1/subscriptions/:id/pause
POST   /api/v1/subscriptions/:id/resume
POST   /api/v1/subscriptions/:id/cancel

# Water Tests
POST   /api/v1/water-tests
GET    /api/v1/water-tests
GET    /api/v1/water-tests/:id/recommendations

# Service Requests
POST   /api/v1/service-requests
GET    /api/v1/service-requests
PUT    /api/v1/service-requests/:id

# Content
GET    /api/v1/content
GET    /api/v1/content/:id

# Notifications
GET    /api/v1/notifications
PUT    /api/v1/notifications/preferences

# UHTD (used by app for spa registration)
GET    /api/v1/uhtd/brands
GET    /api/v1/uhtd/brands/:brand/model-lines
GET    /api/v1/uhtd/model-lines/:modelLine/models
GET    /api/v1/uhtd/models/:model/years

# Admin Endpoints (retailer dashboard)
GET    /api/v1/admin/customers
GET    /api/v1/admin/orders
GET    /api/v1/admin/products
PUT    /api/v1/admin/products/:id/visibility
GET    /api/v1/admin/product-mappings
POST   /api/v1/admin/product-mappings
GET    /api/v1/admin/service-requests
PUT    /api/v1/admin/service-requests/:id
POST   /api/v1/admin/notifications/send
GET    /api/v1/admin/analytics
GET    /api/v1/admin/content
POST   /api/v1/admin/content
PUT    /api/v1/admin/content/:id
DELETE /api/v1/admin/content/:id

# Super Admin Endpoints (TimpCreative)
GET    /api/v1/super-admin/tenants
POST   /api/v1/super-admin/tenants
PUT    /api/v1/super-admin/tenants/:id
GET    /api/v1/super-admin/analytics
GET    /api/v1/super-admin/uhtd/*
POST   /api/v1/super-admin/uhtd/*
PUT    /api/v1/super-admin/uhtd/*
POST   /api/v1/super-admin/messages
GET    /api/v1/super-admin/messages
POST   /api/v1/super-admin/banners
```

---

## Important Reminders

1. **We NEVER store payment information.** If you find yourself writing code that accepts or stores credit card numbers, CVVs, or payment tokens — stop. All payment flows go through Shopify Checkout Kit.

2. **We NEVER modify the retailer's POS data.** We read from it. If we need to create orders, we do it through Shopify's Storefront API which is designed for this purpose.

3. **The UHTD is TimpCreative-owned.** Retailers don't edit it directly. They map their products to it. TimpCreative manages the master data through the super admin dashboard.

4. **Test everything with TAB (Take A Break) first.** They are the launch partner. Every feature should be validated against their real inventory, real products, and real customers before marketing to other retailers.

5. **Privacy matters.** Water test data sharing with retailers requires explicit customer opt-in. Customer data is encrypted at rest and in transit. CCPA compliance is built in from Phase 0.
