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
7. **Important:** Copy the generated API key immediately — you'll need it for the mobile app config

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
| `config.env` | — | Environment configuration |

### Example Directory Structure

```
mobile/tenants/takeabreak/
├── icon.png
├── adaptive-icon.png
├── splash.png
└── config.env
```

---

## Step 3: Create config.env

Create `mobile/tenants/{slug}/config.env` with the following content:

```env
# Tenant identification
TENANT_SLUG=takeabreak
TENANT_API_KEY=tenant_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Firebase Web Config (same for all tenants, from Firebase Console)
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=hot-tub-companion.firebaseapp.com
FIREBASE_PROJECT_ID=hot-tub-companion
```

### Where to Get These Values

| Variable | Source |
|----------|--------|
| `TENANT_SLUG` | The slug you entered in Step 1 |
| `TENANT_API_KEY` | Copied from Step 1 (or view in tenant details) |
| `FIREBASE_*` | Firebase Console → Project Settings → Your apps → Web app |

> ⚠️ **Security:** `config.env` files are git-ignored. Never commit API keys to the repository.

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

### 5.1 Update eas.json (if needed)

The default `eas.json` should work for most cases. If the retailer needs custom build settings, you can add a profile:

```json
{
  "build": {
    "takeabreak-production": {
      "extends": "production",
      "env": {
        "TENANT": "takeabreak"
      }
    }
  }
}
```

### 5.2 Register App with EAS

For a new tenant, you may need to configure the app in EAS:

```bash
cd mobile
TENANT=takeabreak eas build:configure
```

---

## Step 6: Build the Mobile App

### iOS Build

```bash
cd mobile
TENANT=takeabreak eas build --platform ios --profile production
```

This will:
- Use assets from `mobile/tenants/takeabreak/`
- Set bundle ID to `com.hottubcompanion.takeabreak`
- Generate an iOS app archive (.ipa)

### Android Build

```bash
cd mobile
TENANT=takeabreak eas build --platform android --profile production
```

This will:
- Use assets from `mobile/tenants/takeabreak/`
- Set package name to `com.hottubcompanion.takeabreak`
- Generate an Android App Bundle (.aab)

### Build Both Platforms

```bash
cd mobile
TENANT=takeabreak eas build --platform all --profile production
```

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
TENANT=takeabreak eas submit --platform ios
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
TENANT=takeabreak eas submit --platform android
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

- Verify `TENANT` environment variable is set correctly during build
- Check that `config.env` exists in `mobile/tenants/{slug}/`
- Rebuild the app: `TENANT={slug} eas build --platform all --profile production`

### Firebase auth errors

- Verify Firebase API key is correct in `config.env`
- Check Firebase Console → Authentication → Settings → Authorized domains includes your domains
- For mobile, ensure HTTP referer restrictions are disabled or app bundle IDs are whitelisted

### Dashboard login redirects to wrong page

- Clear cookies and try again
- Verify the middleware isn't double-prefixing paths

---

## Quick Reference: Commands

```bash
# Build iOS app for a tenant
TENANT={slug} eas build --platform ios --profile production

# Build Android app for a tenant
TENANT={slug} eas build --platform android --profile production

# Build both platforms
TENANT={slug} eas build --platform all --profile production

# Submit to iOS App Store
TENANT={slug} eas submit --platform ios

# Submit to Google Play Store
TENANT={slug} eas submit --platform android

# Run locally for testing
TENANT={slug} npx expo start
```

---

## Timeline Estimate

| Step | Time |
|------|------|
| Create tenant in dashboard | 5 minutes |
| Set up mobile assets | 30 minutes (depends on branding package) |
| Create config.env | 5 minutes |
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
