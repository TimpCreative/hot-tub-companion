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

### Example Directory Structure

```
mobile/tenants/takeabreak/
├── icon.png
├── adaptive-icon.png
├── splash.png
└── tenant.json
```

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

### 8.1 Create Admin User

The retailer's staff need accounts to access their dashboard:

1. Have the retailer staff member create an account in the **mobile app** first (this creates them in Firebase + database)
2. Or create the Firebase user manually in Firebase Console

### 8.2 Grant Admin Role

Currently, admin roles must be granted via direct database access:

```sql
-- Find the user
SELECT id, email FROM users WHERE tenant_id = '{tenant_uuid}' AND email = 'admin@retailer.com';

-- Create admin role (can_send_notifications defaults to true)
INSERT INTO admin_roles (tenant_id, user_id, role, can_view_customers, can_view_orders, can_manage_products, can_manage_content, can_manage_service_requests, can_view_analytics, can_manage_subscriptions, can_manage_settings)
VALUES (
  '{tenant_uuid}',
  '{user_uuid}',
  'owner',
  true, true, true, true, true, true, true, true
);
```

> **Future Enhancement:** Add admin role management to the super admin dashboard (Phase 1+)

### 8.3 Verify Dashboard Access

1. Go to `https://{slug}.hottubcompanion.com`
2. Log in with the admin user's credentials
3. Verify dashboard loads with correct branding

---

## Step 9: Configure POS Integration (if applicable)

If the retailer uses Shopify:

1. Go to super admin → Tenants → {Tenant} → Edit
2. Add Shopify credentials:
   - **Shopify Store URL:** `{store}.myshopify.com`
   - **Storefront API Token:** From Shopify Admin → Apps → Develop apps
   - **Admin API Token:** From Shopify Admin → Apps → Develop apps
3. Trigger initial product sync

> **Note:** Full POS integration is implemented in Phase 1.

---

## Step 10: Final Verification Checklist

Before announcing go-live to the retailer:

- [ ] **Super Admin Dashboard**
  - [ ] Tenant appears in tenant list
  - [ ] Tenant details page shows correct info
  - [ ] API key is masked and revealable

- [ ] **Retailer Admin Dashboard**
  - [ ] `{slug}.hottubcompanion.com` loads
  - [ ] Login works for admin user
  - [ ] Branding colors are correct

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
