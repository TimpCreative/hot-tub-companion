# Creating a New Tenant — Complete Guide

This document walks through every step required to onboard a new retailer to the Hot Tub Companion platform. Follow these steps in order.

---

## Prerequisites

Before starting, ensure you have:

- [ ] Signed contract with the retailer
- [ ] Access to super admin dashboard (`admin.hottubcompanion.com`)
- [ ] Retailer's branding package:
  - Logo (PNG, transparent background, min 512x512px)
  - App icon (1024x1024px PNG)
  - Splash screen image (1284x2778px PNG recommended)
  - Brand colors (primary, secondary hex codes)
- [ ] Retailer's Shopify store URL (if using Shopify)
- [ ] Decide which Shopify setup path applies:
  - merchant-managed credentials only (current HTC flow)
  - future Partner/CLI-managed Shopify app (not required for current onboarding)
- [ ] EAS CLI installed (`npm install -g eas-cli`)
- [ ] Apple Developer account access
- [ ] Google Play Console access

---

## Step 1: Create Tenant in Super Admin Dashboard

1. Go to `https://admin.hottubcompanion.com`
2. Log in with your super admin credentials
3. Navigate to **Tenants** in the sidebar
4. Click **Create Tenant**
5. Fill in the form:
   - **Name:** Full business name (e.g., "Take A Break Spas & Billiards")
   - **Slug:** URL-safe identifier, lowercase, hyphens only (e.g., `takeabreak`)
     - This becomes: `takeabreak.hottubcompanion.com`
     - This becomes: bundle ID `com.hottubcompanion.takeabreak`
   - **API Key:** Leave blank to auto-generate, or provide a custom key
   - **Primary Color:** Hex code (e.g., `#1B4D7A`)
   - **Secondary Color:** Hex code (e.g., `#E8A832`)
6. Click **Create**
7. **Important:** The API key is stored in the database. For **EAS cloud builds**, you do not paste it into Expo if `EAS_BUILD_CONFIG_SECRET` is configured; pick the profile `preview-<slug>` or `production-<slug>` (see Step 5). For **local** `expo start`, put secrets in **`mobile/.env`** (or `eas env:pull`) — see Step 3.

### Retailer dashboard hostname and Vercel (optional automation)

When a tenant is created, the API can register **`{slug}.{hostname}`** on your Vercel dashboard project (e.g. `hot-tub-companion`) so the retailer admin URL is recognized by Vercel. The hostname comes from **`DASHBOARD_BASE`** on the API (default `https://hottubcompanion.com` → `hottubcompanion.com`).

**Railway / API environment (optional):**

| Variable | Purpose |
|----------|---------|
| `PUBLIC_API_URL` | Public **HTTPS** base URL of the API (no trailing slash), e.g. `https://api.hottubcompanion.com`. Used when registering Shopify catalog webhooks. |
| `CRON_SECRET` | Min 32 characters; required header for internal cron routes (e.g. incremental Shopify catalog pull). |
| `EAS_BUILD_CONFIG_SECRET` | Min 32 characters; same value must be set in **Expo** env vars. EAS builds call `GET /api/v1/internal/eas-tenant-config` to load the tenant’s `api_key` by slug (no per-tenant key in Expo). |
| `VERCEL_TOKEN` | Vercel personal or team token with permission to manage project domains. |
| `VERCEL_PROJECT_ID` | Vercel project **id** or **name** (e.g. `hot-tub-companion`). |
| `VERCEL_TEAM_ID` | Required if the project is under a Vercel team. |

If these are unset, tenant creation still succeeds; Vercel attach is recorded as **skipped** and you can add the domain manually in Vercel.

**DNS:** Vercel only registers the hostname on the project. Your DNS (e.g. Namecheap) must still resolve `{slug}.hottubcompanion.com` to Vercel—typically a **wildcard** `*` CNAME to Vercel’s target, or a **per-slug** CNAME for each tenant.

**Reserved slugs:** You cannot use `admin`, `www`, `hottubcompanion`, or `api` as a tenant slug (they conflict with platform routing).

---

## Step 2: Set Up Mobile App Assets

Create a tenant directory with branding assets:

```bash
cd mobile/tenants
mkdir {slug}
```

### Required Files

Create these files in `mobile/tenants/{slug}/`:

| File | Dimensions | Description |
|------|------------|-------------|
| `icon.png` | 1024x1024px | App icon (no transparency for iOS) |
| `adaptive-icon.png` | 1024x1024px | Android adaptive icon foreground |
| `splash.png` | 1284x2778px | Splash screen image |
| `tenant.json` | n/a | Tenant metadata used to generate EAS profiles and build config |

### Example Directory Structure

```
mobile/tenants/takeabreak/
├── icon.png
├── adaptive-icon.png
├── splash.png
└── tenant.json
```

---

### Required `tenant.json`

Create `mobile/tenants/{slug}/tenant.json` with this shape:

```json
{
  "name": "Take A Break Spas",
  "slug": "takeabreak",
  "bundleId": "com.hottubcompanion.takeabreak",
  "icon": "icon.png",
  "splash": "splash.png",
  "adaptiveIcon": "adaptive-icon.png"
}
```

Notes:
- `slug` must match the tenant slug from Step 1 exactly
- `bundleId` must match the app store identifiers you intend to ship
- the file names should match the assets you placed in the tenant folder

---

## Step 3: Local env for `expo start` (mobile/.env)

Do **not** commit secrets. Use a single **`mobile/.env`** (gitignored) or run `eas env:pull --environment development` from `mobile/` after setting variables on expo.dev.

Minimum variables for local development:

```env
TENANT=takeabreak
API_URL=https://api.hottubcompanion.com
TENANT_API_KEY=tenant_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=auth.hottubcompanion.com
FIREBASE_PROJECT_ID=hot-tub-companion
```

### Where to Get These Values

| Variable | Source |
|----------|--------|
| `TENANT` | Same as folder name / slug from Step 1 |
| `TENANT_API_KEY` | Copied from Step 1 (or view in tenant details) |
| `API_URL` | Your deployed API base URL |
| `FIREBASE_*` | Firebase Console → Project Settings → Your apps → Web app |

> ⚠️ **Security:** Never commit `mobile/.env`. Optional legacy `mobile/tenants/{slug}/config.env` is still supported if the file exists (also gitignored).

---

## Step 4: Verify Tenant Configuration Locally

Before building, test the configuration locally:

```bash
cd mobile

# Set the tenant for this session
export TENANT=takeabreak

# Start Expo
npx expo start
```

Verify:
- [ ] App loads with correct branding colors
- [ ] Splash screen shows retailer's image
- [ ] Login works
- [ ] Tenant config fetches correctly from API

---

## Step 5: Configure EAS Build

After `mobile/tenants/{slug}/` exists with `tenant.json` and assets, regenerate EAS profiles:

```bash
cd mobile
npm run eas:generate
```

This rewrites `eas.json` with **`preview-{slug}`** (internal / TestFlight-style) and **`production-{slug}`** (store) for every retailer tenant. The template **`default`** folder is excluded from generated profiles (edit `scripts/generate-eas-json.js` if you need it).

Commit the updated `eas.json`. Configure Apple/Google credentials in EAS the first time you build a new bundle ID.

---

## Step 6: Build the Mobile App

Use the profile that matches the slug (not shell `TENANT=` — cloud builds do not receive it).

### iOS — internal / preview

```bash
cd mobile
eas build --platform ios --profile preview-takeabreak
```

### iOS — store

```bash
cd mobile
eas build --platform ios --profile production-takeabreak
```

### Android — internal / preview

```bash
cd mobile
eas build --platform android --profile preview-takeabreak
```

### Android — store

```bash
cd mobile
eas build --platform android --profile production-takeabreak
```

### Build both platforms (store)

```bash
cd mobile
eas build --platform all --profile production-takeabreak
```

Each profile sets `env.TENANT` to the slug so the correct icons, bundle ID, and API key fetch apply.

---

## Step 7: Submit to App Stores

### 7.1 Apple App Store

#### First-Time Setup (per tenant)

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** {Retailer Name} (e.g., "Take A Break Spas")
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** Select `com.hottubcompanion.{slug}`
   - **SKU:** `hottubcompanion-{slug}`
4. Complete the app information:
   - Description, keywords, screenshots, etc.
   - Privacy policy URL
   - Support URL

#### Submit Build

```bash
eas submit --platform ios --profile production-takeabreak
```

Or submit manually:
1. Download the .ipa from EAS dashboard
2. Upload via Transporter app or App Store Connect

### 7.2 Google Play Store

#### First-Time Setup (per tenant)

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. Fill in:
   - **App name:** {Retailer Name}
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free
4. Complete the store listing:
   - Description, screenshots, feature graphic
   - Privacy policy URL
   - Content rating questionnaire

#### Submit Build

```bash
eas submit --platform android --profile production-takeabreak
```

Or submit manually:
1. Download the .aab from EAS dashboard
2. Upload via Google Play Console → Release → Production

---

## Step 8: Set Up Retailer Admin Access

### 8.1 Understand the current admin-access flow

Retailer admin access is now primarily managed through the **Retailer Admin → Team** page.

What is implemented today:
- admins can invite other admins from the Team page
- invited users get an `admin_roles` entry
- new users can be provisioned automatically during invite
- role/permission management is handled in the Team UI

What is **not** fully self-serve yet:
- Super Admin does **not** currently have a dedicated “create retailer admin user” UI
- the **first** retailer owner/admin still needs a bootstrap path before they can invite others

### 8.2 Bootstrap the first retailer admin

Use one of these supported bootstrap methods:

#### Option A: Existing tenant-admin override / internal bootstrap

If your environment already grants internal tenant-admin override access, use that to log into the retailer admin and then invite the retailer's real users from **Team**.

#### Option B: Direct database bootstrap for the first owner

If no retailer admin exists yet, create the first owner role directly in the database.

1. Make sure the future retailer admin user exists in Firebase and in `users`
   - easiest path: have them create an account in the app first
   - or create them manually in Firebase, then ensure a matching `users` row exists for the tenant

2. Insert or update the initial owner role:

```sql
-- Find the user
SELECT id, email
FROM users
WHERE tenant_id = '{tenant_uuid}'
  AND email = 'admin@retailer.com';

-- Create the first owner role
INSERT INTO admin_roles (
  tenant_id,
  user_id,
  role,
  can_view_customers,
  can_view_orders,
  can_manage_products,
  can_manage_content,
  can_manage_service_requests,
  can_send_notifications,
  can_view_analytics,
  can_manage_subscriptions,
  can_manage_settings,
  can_manage_users
)
VALUES (
  '{tenant_uuid}',
  '{user_uuid}',
  'owner',
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true
);
```

Once that first owner can log in, all additional retailer admins should be added through the Team page instead of direct database edits.

### 8.3 Invite additional retailer admins

After the first owner is in place:

1. Log into `https://{slug}.hottubcompanion.com`
2. Open **Team**
3. Click **Invite admin**
4. Enter the email and role
5. Send the invite

What the system does:
- if the user already exists for that tenant, it updates/adds their admin role
- if they do not exist yet, it provisions the user and creates the admin role
- if SendGrid is configured, the invite email includes a sign-in or password-setup link

### 8.4 Verify dashboard access

1. Go to `https://{slug}.hottubcompanion.com`
2. Log in with the admin user's credentials
3. Verify dashboard loads with correct branding
4. Verify the **Team** page is accessible for owner users
5. Verify invited admins receive the expected permissions

---

## Step 9: Configure Shopify POS Integration (if applicable)

If the retailer uses Shopify, connect Shopify to the tenant.

### 9.0 Choose the right Shopify setup model first

There are two different Shopify patterns that can sound similar but are **not** the same:

- **Current Hot Tub Companion onboarding:** merchant-managed credentials saved into HTC
- **Shopify's newer recommended app-development workflow:** a Dev Dashboard / Shopify CLI-managed app project

For **current tenant onboarding**, continue using the merchant-managed credential flow below. That is what our platform supports today.

Why this matters:
- Shopify's CLI guidance is for building and managing Shopify apps in code
- it uses files like `shopify.app.toml` and commands such as `shopify app init`, `shopify app config link`, and `shopify app deploy`
- Shopify also notes that CLI deployment automation is for **Partner organization** apps and is **not** the CI/CD path for merchant-owned apps created in the Dev Dashboard or directly in Shopify admin

References:
- [Shopify CLI for apps](https://shopify.dev/docs/apps/build/cli-for-apps)
- [Migrate from a Dev Dashboard-managed app to Shopify CLI](https://shopify.dev/docs/apps/build/cli-for-apps/migrate-from-dashboard)
- [Deploy app components in a CD pipeline](https://shopify.dev/docs/apps/launch/deployment/deploy-in-ci-cd-pipeline)

### 9.1 Create the Shopify app in Dev Dashboard

For new tenants, use Shopify's **Dev Dashboard** flow.

1. In Shopify admin, go to **Settings** → **Apps**
2. Click **Build apps in Dev Dashboard**
3. In Dev Dashboard, create the app for this retailer
4. Configure scopes and release a version
5. Install the app on the retailer store

### 9.2 Required Shopify access

For the current integration, the connection is used for:

- product sync through the Shopify **Admin API**
- registering and receiving webhooks (`products/update`, `inventory_levels/update`, `orders/create`, etc.) — permission comes from **resource** scopes, not a separate “webhooks” scope in the current picker
- **Storefront API** when the mobile app uses cart + Checkout Kit ([PHASE-3-ENGAGEMENT.md](./PHASE-3-ENGAGEMENT.md))
- future **loyalty / discount-code** flows via Admin API ([PHASE-5-GROWTH.md](./PHASE-5-GROWTH.md))

#### Distribution (one app, many unrelated stores)

To install the **same** Partner app on **many independent retailers**, use **[Public distribution](https://shopify.dev/docs/apps/launch/distribution)** and the normal listing / install flow. **[Custom distribution](https://shopify.dev/docs/apps/launch/distribution)** is geared toward one shop, **Plus** org siblings, or controlled install links — see [Select a distribution method](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method). Shopify **does not allow changing distribution after you choose it**; pick the model that matches how many merchants you serve.

**Credentials:** one **Client ID** and **Client Secret** for the app; each HTC tenant row stores that retailer’s **`{shop}.myshopify.com`** (and secrets remain encrypted server-side).

#### Admin API — exact scopes (current Dev Dashboard picker)

These string names match Shopify’s [authenticated access scopes](https://shopify.dev/docs/api/usage/access-scopes) and the Dev Dashboard checklist. The picker **does not** list `read_shop` or `read_webhooks` / `write_webhooks`; subscribing to `products/update`, `inventory_levels/update`, and order topics is governed by **`read_products`**, **`read_inventory`**, and **`read_orders`** respectively (see [webhook topics](https://shopify.dev/docs/api/admin-rest/latest/resources/webhook) / Shopify’s topic-to-scope notes).

Enable **read** variants only unless you need writes:

| Scope | Purpose |
|-------|---------|
| `read_products` | `GET /products.json` / count — full and incremental catalog sync; `products/update` webhooks. |
| `read_inventory` | Inventory alignment; `inventory_levels/update` webhooks. |
| `read_orders` | `orders/create`, `orders/paid`, etc., when registered. |
| `read_price_rules` | Read price rules (pairs with discount APIs for loyalty). |
| `write_price_rules` | Create/update price rules (loyalty / programmatic discounts). |
| `read_discounts` | Read discount configuration. |
| `write_discounts` | Create/update discounts (e.g. codes from redemption flow). |

**Optional tightening:** if you delay loyalty shipping, you may omit the four discount/price-rule scopes until that feature exists — then merchants must **re-approve** a new app version when you add them.

The backend still calls `GET /admin/api/.../shop.json` to compare the configured shop with Shopify’s response. That works with the token produced for an install using the scopes above; if a scope or API version ever returns **403** on that call alone, reinstall after a scope change and check Shopify’s docs for that version.

#### Storefront API — cart, Checkout Kit, browse

Enable when the mobile storefront path is live:

- `unauthenticated_read_checkouts`
- `unauthenticated_write_checkouts`
- `unauthenticated_read_product_listings`
- `unauthenticated_read_product_inventory`

Add other Storefront scopes only if you build those features (e.g. `unauthenticated_read_selling_plans`, bundles).

### 9.4 Save the connection in Hot Tub Companion

You can currently save the Shopify connection in either of these places:

- **Super Admin** → **Tenants** → `{Tenant}` → **POS Integration**
- **Retailer Admin** → **Settings** → **POS Integration**

Fill in:

- **Provider:** `Shopify`
- **Shopify Store URL:** `https://{store}.myshopify.com` (normalized to `{store}.myshopify.com`)
- **Shopify Client ID:** from Dev Dashboard app Settings
- **Shopify Client Secret:** from Dev Dashboard app Settings (write-only in HTC)
- **Shopify Storefront Token:** optional for now; required when storefront cart/checkout flows go live
- **Shopify Webhook Secret:** required for verifying webhooks (`orders/create` plus catalog webhooks when automatic sync is enabled)

### 9.5 Automatic catalog and inventory sync (recommended)

After POS credentials and **Shopify Webhook Secret** are saved:

1. Set **`PUBLIC_API_URL`** on the API host to the public HTTPS origin of this service (no trailing slash), e.g. `https://api.hottubcompanion.com`. The API uses it when registering Shopify webhooks. Local development needs a tunnel with HTTPS if you test webhooks.
2. In **Retailer Admin** → **Settings** → **POS Integration** (or Super Admin tenant POS), turn on **Automatic catalog & inventory sync**. The API registers Shopify Admin webhooks for:
   - `products/update`
   - `inventory_levels/update`
3. Turning sync **off** removes those webhook registrations (best effort) and stops processing catalog webhooks for that tenant (requests still return success to Shopify).
4. Schedule an external job (Railway cron, GitHub Actions, etc.) to `POST /api/v1/internal/cron/sync-shopify-catalog` every **1–2 minutes** with the **`CRON_SECRET`** header. Per-tenant **incremental sync interval** (default 30 minutes, clamped 1–1440) throttles how often each store is pulled via `updated_at_min` pagination. Webhooks (`products/create`, `products/update`, `products/delete`, `inventory_levels/update`) should handle most catalog changes within seconds; the cron is a safety net.
5. **Full catalog sync** (all pages) is for onboarding or backfill; run it from **Settings** → **POS Integration**, not from the Products page. Day-to-day inventory freshness should rely on webhooks plus the incremental cron.

**Maintenance reminders (customer app):** Schedule a **daily** job (e.g. Railway Cron) to `POST /api/v1/internal/cron/maintenance-reminders` with the same **`CRON_SECRET`** header used for other internal cron routes. This drives Care schedule push notifications for pending `maintenance_events` when the user has maintenance notifications enabled.

### 9.6 Important security behavior

- Secrets are stored securely on the server
- Secret fields are **write-only**
- After saving, the UI should only show configured/unconfigured state
- Secrets are **not revealable**
- If a secret is lost, regenerate in Shopify and replace it in Hot Tub Companion

### 9.7 Test and initial import

1. Click **Test Connection**
2. Confirm token exchange succeeds and shop domain matches this tenant
3. Run **Run full catalog sync now** from **Settings** → **POS Integration** (retailer with `can_manage_settings`) or **Run Full Sync** from Super Admin tenant POS for support

### 9.8 Current limitations

- The current **Test Connection** path validates Dev Dashboard app credentials and Admin API access for product sync
- Storefront access is configured now, but full storefront cart/checkout usage is exercised in the next commerce milestones
- Large catalogs should use batched full import and rely on automatic sync for ongoing changes; monitor API rate limits
- Tenant onboarding is now based on Dev Dashboard app credentials saved in POS Integration per tenant

> **Note:** POS credential management and catalog sync controls are available in both Super Admin and Retailer Admin **Settings** → **POS Integration**. Users running a full import from the retailer dashboard need **`can_manage_settings`**.

---

## Step 10: Final Verification Checklist

Before announcing go-live to the retailer:

- [ ] **Super Admin Dashboard**
  - [ ] Tenant appears in tenant list
  - [ ] Tenant details page shows correct info
  - [ ] API key is masked
  - [ ] POS Integration shows configured state without revealing secrets

- [ ] **Retailer Admin Dashboard**
  - [ ] `{slug}.hottubcompanion.com` loads
  - [ ] Login works for the initial owner/admin
  - [ ] Branding colors are correct
  - [ ] Team page loads for users with `can_manage_users`
  - [ ] Invite flow works for additional admins
  - [ ] POS Integration appears in Settings
  - [ ] Shopify secrets can be replaced, but not revealed

- [ ] **Mobile App (iOS)**
  - [ ] App icon is correct
  - [ ] Splash screen shows retailer branding
  - [ ] Login works
  - [ ] Tenant config loads (correct colors, features)

- [ ] **Mobile App (Android)**
  - [ ] App icon is correct
  - [ ] Splash screen shows retailer branding
  - [ ] Login works
  - [ ] Tenant config loads (correct colors, features)

- [ ] **App Store Listings**
  - [ ] iOS app approved and live (or in review)
  - [ ] Android app approved and live (or in review)

---

## Troubleshooting

### "Tenant not found or inactive"

- Verify tenant status is `active` in the database
- Verify `DATABASE_URL` is set in Vercel environment variables
- Check that the slug in the URL matches exactly

### Mobile app shows wrong branding

- Verify you used the correct EAS profile (`preview-{slug}` or `production-{slug}`) so `env.TENANT` matches the retailer
- Run `npm run eas:generate` after adding a tenant folder, then commit `eas.json`
- For local dev, ensure `mobile/.env` (or shell `export`) includes `TENANT` and `TENANT_API_KEY`
- Rebuild: `eas build --platform all --profile production-{slug}`

### Firebase auth errors

- Verify Firebase API key is correct in `mobile/.env`
- Check Firebase Console → Authentication → Settings → Authorized domains includes your domains
- For mobile, ensure HTTP referer restrictions are disabled or app bundle IDs are whitelisted

### Dashboard login redirects to wrong page

- Clear cookies and try again
- Verify the middleware isn't double-prefixing paths

---

## Quick Reference: Commands

```bash
# Regenerate eas.json after adding mobile/tenants/{slug}/
cd mobile && npm run eas:generate

# Build iOS app for a tenant (store)
eas build --platform ios --profile production-{slug}

# Build Android app for a tenant (store)
eas build --platform android --profile production-{slug}

# Internal / TestFlight-style
eas build --platform ios --profile preview-{slug}

# Submit to iOS App Store
eas submit --platform ios --profile production-{slug}

# Submit to Google Play Store
eas submit --platform android --profile production-{slug}

# Run locally for testing
export TENANT={slug}
npx expo start
```

---

## Timeline Estimate

| Step | Time |
|------|------|
| Create tenant in dashboard | 5 minutes |
| Set up mobile assets | 30 minutes (depends on branding package) |
| Set `mobile/.env` (or Expo pull) | 5 minutes |
| Local testing | 15 minutes |
| Build apps (iOS + Android) | 20-40 minutes (EAS cloud build) |
| App Store submission | 30 minutes (first time), 10 minutes (subsequent) |
| App review | 1-7 days (Apple), 1-3 days (Google) |
| **Total (excluding review)** | **~2 hours** |

---

## Support

For issues not covered here:
- Check the main `README.md` for development setup
- Review `PHASE-0-FOUNDATION.md` for architecture details
- Contact the TimpCreative team
