# Phase 0 — Foundation

**Depends on:** Nothing. This is the starting point.
**Unlocks:** All subsequent phases.
**Estimated effort:** 2–3 weeks

---

## Manual Steps Required (Do These First)

Before any code is written, a human must complete these tasks:

1. **Create a Railway account** at https://railway.com and upgrade to Pro plan ($20/mo). Create a new project called "hot-tub-companion".

2. **Create a Firebase project** at https://console.firebase.google.com. Name it "hot-tub-companion". Enable:
   - Authentication → Email/Password sign-in method
   - Cloud Messaging (FCM)
   - Storage (for file uploads)
   - Note the Firebase config values (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId)

3. **Register an Apple Developer Account** at https://developer.apple.com ($99/year) if you don't have one. This single account will be used for all retailer app submissions.

4. **Register a Google Play Developer Account** at https://play.google.com/console ($25 one-time) if you don't have one.

5. **Install Expo Application Services (EAS)**: Run `npm install -g eas-cli` and log in with `eas login`.

6. **Register the domain** `hottubcompanion.com` if not already owned. Configure DNS:
   - `api.hottubcompanion.com` → will point to Railway deployment
   - `admin.hottubcompanion.com` → will point to Vercel/Railway for super admin dashboard
   - `*.hottubcompanion.com` → wildcard for retailer subdomains, pointed to Vercel/Railway for retailer dashboards

7. **Create a SendGrid account** at https://sendgrid.com. Generate an API key. Verify your sending domain (hottubcompanion.com).

8. **Create a GitHub repository** named `hot-tub-companion` with three directories at root:
   - `/api` — Node.js/Express backend
   - `/mobile` — React Native/Expo mobile app
   - `/dashboard` — Next.js web app (retailer + super admin dashboards)

9. **Obtain TAB's Shopify/Lightspeed credentials** (or set up a Shopify development store for testing):
   - If TAB uses Shopify: Get Storefront API access token and Admin API access token
   - If TAB uses Lightspeed X-Series: Register a developer account at Lightspeed, create an app, get client_id and client_secret
   - For initial development, use a Shopify development store (free through Shopify Partners program at https://partners.shopify.com)

---

## What Phase 0 Builds

Phase 0 creates the skeleton that everything else hangs on. At the end of this phase, you should have:

- A deployed Node.js/Express API with health check endpoint
- A PostgreSQL database with core schema tables
- Firebase Auth integration for user registration/login
- A React Native/Expo project with white-label configuration system
- A Next.js dashboard project with subdomain routing (retailer + super admin)
- CI/CD pipeline for API deployment to Railway
- All projects running locally and connected to each other

---

## Part 1: Backend API

### 1.1 Initialize the Project

```bash
cd api/
npm init -y
```

Install dependencies:
```bash
npm install express cors helmet morgan dotenv pg knex bcryptjs jsonwebtoken firebase-admin uuid express-rate-limit compression
npm install -D nodemon typescript @types/express @types/node @types/cors ts-node
```

We are using **Knex.js** as the query builder (not an ORM). This gives us direct SQL control with migration support.

### 1.2 Project Structure

```
/api
  /src
    /config
      database.ts          # Knex configuration
      firebase.ts          # Firebase Admin SDK init
      environment.ts       # Environment variable validation
    /middleware
      auth.ts              # Firebase token verification
      tenant.ts            # Tenant identification & injection
      errorHandler.ts      # Global error handler
      rateLimiter.ts       # Rate limiting per tenant
      roleGuard.ts         # Role-based access control
    /routes
      index.ts             # Route aggregator
      auth.routes.ts       # Registration, login
      tenant.routes.ts     # Tenant config (public)
      health.routes.ts     # Health check
    /controllers
      auth.controller.ts
      tenant.controller.ts
    /services
      auth.service.ts
      tenant.service.ts
      email.service.ts     # SendGrid integration
    /utils
      response.ts          # Standardized API response format
      errors.ts            # Custom error classes
      logger.ts            # Structured logging
    app.ts                 # Express app setup
    server.ts              # Server entry point
  /migrations              # Knex migration files
  /seeds                   # Knex seed files
  knexfile.ts              # Knex configuration for CLI
  tsconfig.json
  .env.example
  package.json
```

### 1.3 Environment Variables

Create `.env.example` with all required variables:

```env
# Server
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/hottubcompanion

# Firebase Admin SDK
FIREBASE_PROJECT_ID=hot-tub-companion
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@hot-tub-companion.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# JWT (for admin dashboard sessions, separate from Firebase)
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRES_IN=7d

# SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@hottubcompanion.com
SENDGRID_FROM_NAME=Hot Tub Companion

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key-here
```

### 1.4 Express App Setup (app.ts)

Configure Express with:
- CORS: Allow origins matching `*.hottubcompanion.com` and `localhost:*` in development
- Helmet: Security headers
- Morgan: Request logging
- Compression: Gzip responses
- JSON body parser with 10MB limit (for product sync payloads)
- Rate limiting: 100 requests per minute per IP (default), configurable per route
- Global error handler middleware

### 1.5 Tenant Middleware (Critical)

Every API request (except `/health`, `/api/v1/auth/*`, and `/api/v1/tenant/config`) must pass through tenant middleware that:

1. Extracts tenant identification from the `x-tenant-key` request header
2. Looks up the tenant in the database by API key
3. If not found, returns 401 Unauthorized
4. If found, attaches `req.tenant` with the full tenant object (id, name, slug, features, config)
5. All subsequent database queries in the request MUST include `WHERE tenant_id = req.tenant.id`

For the `/api/v1/tenant/config` endpoint, the tenant key is still required but this endpoint returns public configuration (branding, features, service types) — it does not require user authentication.

### 1.6 Auth Middleware

For authenticated endpoints:

1. Extract Bearer token from Authorization header
2. Verify token with Firebase Admin SDK (`admin.auth().verifyIdToken(token)`)
3. Look up user in our database by Firebase UID + tenant_id
4. If not found, return 401
5. Attach `req.user` with full user object
6. Check `req.user.role` against required role (for admin endpoints)

### 1.7 Standardized Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

---

## Part 2: Database Schema

### 2.1 Initialize Knex

```bash
npx knex init --knexfile knexfile.ts
```

Configure Knex to use PostgreSQL with the `DATABASE_URL` environment variable. Enable UUID support with `pgcrypto` extension.

### 2.2 Migration: Create Core Tables

Create a migration file for the foundational tables. All tables use UUID primary keys generated by `gen_random_uuid()`.

#### Table: `tenants`
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,  -- used for subdomain: slug.hottubcompanion.com
  api_key VARCHAR(255) NOT NULL UNIQUE,  -- used by mobile app to identify tenant
  api_key_hash VARCHAR(255) NOT NULL,  -- hashed version for lookup

  -- Branding
  primary_color VARCHAR(7) DEFAULT '#1B4D7A',
  secondary_color VARCHAR(7) DEFAULT '#E8A832',
  accent_color VARCHAR(7) DEFAULT '#FFFFFF',
  font_family VARCHAR(100) DEFAULT 'System',
  logo_url TEXT,
  icon_url TEXT,

  -- Features (boolean toggles)
  feature_subscriptions BOOLEAN DEFAULT true,
  feature_loyalty BOOLEAN DEFAULT false,
  feature_referrals BOOLEAN DEFAULT false,
  feature_water_care BOOLEAN DEFAULT true,
  feature_service_scheduling BOOLEAN DEFAULT true,
  feature_seasonal_timeline BOOLEAN DEFAULT true,

  -- POS Integration
  pos_type VARCHAR(50),  -- 'shopify' | 'lightspeed' | null
  shopify_store_url VARCHAR(255),
  shopify_storefront_token TEXT,  -- encrypted
  shopify_admin_token TEXT,  -- encrypted
  lightspeed_client_id VARCHAR(255),  -- encrypted
  lightspeed_client_secret TEXT,  -- encrypted
  lightspeed_access_token TEXT,  -- encrypted
  lightspeed_refresh_token TEXT,  -- encrypted
  lightspeed_domain_prefix VARCHAR(255),

  -- Fulfillment
  fulfillment_mode VARCHAR(20) DEFAULT 'self',  -- 'self' | 'tab'

  -- Sync
  last_product_sync_at TIMESTAMPTZ,
  product_sync_interval_minutes INTEGER DEFAULT 30,

  -- Status
  status VARCHAR(20) DEFAULT 'onboarding',  -- 'onboarding' | 'active' | 'suspended' | 'churned'
  contract_start_date DATE,
  contract_end_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  firebase_uid VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  country VARCHAR(50) DEFAULT 'US',

  -- Role
  role VARCHAR(20) DEFAULT 'customer',  -- 'customer' | 'admin' | 'sales' | 'service_manager' | 'owner'

  -- Preferences
  notification_pref_maintenance BOOLEAN DEFAULT true,
  notification_pref_orders BOOLEAN DEFAULT true,
  notification_pref_subscriptions BOOLEAN DEFAULT true,
  notification_pref_service BOOLEAN DEFAULT true,
  notification_pref_promotional BOOLEAN DEFAULT true,

  -- Privacy
  share_water_tests_with_retailer BOOLEAN DEFAULT false,

  -- FCM
  fcm_token TEXT,
  fcm_token_updated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, email),
  UNIQUE(tenant_id, firebase_uid)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_firebase ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(tenant_id, email);
```

#### Table: `spa_profiles`
```sql
CREATE TABLE spa_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Spa Identity
  brand VARCHAR(100) NOT NULL,
  model_line VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  serial_number VARCHAR(100),
  nickname VARCHAR(100),  -- user-friendly name like "Backyard Spa"

  -- Sanitization
  sanitization_system VARCHAR(20) NOT NULL,  -- 'bromine' | 'chlorine' | 'frog_ease' | 'copper' | 'silver_mineral'

  -- Seasonal Usage
  usage_months INTEGER[] DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}',  -- months tub is in use (1=Jan, 12=Dec)

  -- UHTD Link
  uhtd_spa_model_id UUID,  -- references uhtd_spa_models(id), nullable until matched

  -- Tracking
  purchase_date DATE,
  warranty_expiration_date DATE,
  last_filter_change DATE,
  last_water_test_at TIMESTAMPTZ,

  is_primary BOOLEAN DEFAULT false,  -- first spa registered is primary

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spa_profiles_user ON spa_profiles(user_id);
CREATE INDEX idx_spa_profiles_tenant ON spa_profiles(tenant_id);
```

#### Table: `admin_roles` (for role-based access on retailer dashboard)
```sql
CREATE TABLE admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,  -- 'owner' | 'admin' | 'sales' | 'service_manager'

  -- Granular permissions
  can_view_customers BOOLEAN DEFAULT false,
  can_view_orders BOOLEAN DEFAULT false,
  can_manage_products BOOLEAN DEFAULT false,  -- hide/show, not edit
  can_manage_content BOOLEAN DEFAULT false,
  can_manage_service_requests BOOLEAN DEFAULT false,
  can_send_notifications BOOLEAN DEFAULT false,
  can_view_analytics BOOLEAN DEFAULT false,
  can_manage_subscriptions BOOLEAN DEFAULT false,
  can_manage_settings BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, user_id)
);
```

### 2.3 Seed: Create Test Tenant

Create a seed file that inserts a test tenant for development:

```javascript
// Seed: Take A Break Spas (development)
{
  name: 'Take A Break Spas & Billiards',
  slug: 'takeabreak',
  api_key: 'tab_dev_xxxxxxxxxxxxxxxx', // generate a secure random string
  primary_color: '#1B4D7A',  // placeholder, get real brand colors from TAB
  secondary_color: '#E8A832',
  status: 'active',
  pos_type: 'shopify', // or 'lightspeed' depending on what TAB uses
  feature_subscriptions: true,
  feature_loyalty: true,
  feature_referrals: false,
  feature_water_care: true,
  feature_service_scheduling: true,
  feature_seasonal_timeline: true,
  fulfillment_mode: 'self'
}
```

Also seed a test admin user for the dashboard (after creating the user in Firebase Auth manually or through a setup script).

---

## Part 3: Auth Flow

### 3.1 Registration Endpoint

`POST /api/v1/auth/register`

**Headers:** `x-tenant-key` (required)

**Body:**
```json
{
  "email": "customer@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "801-555-0123"
}
```

**Flow:**
1. Validate input (email format, password min 8 chars, required fields)
2. Check if email already exists for this tenant
3. Create user in Firebase Auth via Admin SDK (`admin.auth().createUser()`)
4. Insert user record in our `users` table with the Firebase UID, tenant_id, and role='customer'
5. Generate a custom Firebase token for immediate sign-in
6. Return user profile + token

### 3.2 Login Endpoint

`POST /api/v1/auth/login`

Login happens primarily client-side via Firebase SDK. The mobile app calls Firebase `signInWithEmailAndPassword()`, gets a Firebase ID token, and sends it to our API for verification.

**Headers:** `x-tenant-key`, `Authorization: Bearer <firebase-id-token>`

**Flow:**
1. Verify Firebase ID token via Admin SDK
2. Look up user by Firebase UID + tenant_id
3. If not found, return 404 (user may have registered with a different retailer's app)
4. Update FCM token if provided
5. Return user profile

### 3.3 Admin Login

Admin users (retailer staff) log in through the dashboard. Same Firebase Auth flow, but after verification, the system checks the user's role in `admin_roles` table. If no admin role exists, access is denied.

Admin roles are created by TimpCreative during onboarding (Phase 0) or by existing admins with `can_manage_settings` permission.

---

## Part 4: React Native / Expo Mobile App

### 4.1 Initialize the Project

```bash
cd mobile/
npx create-expo-app hot-tub-companion --template blank-typescript
```

Install core dependencies:
```bash
npx expo install expo-router expo-splash-screen expo-status-bar expo-constants expo-secure-store
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack
npm install axios react-native-safe-area-context react-native-screens
npm install @shopify/checkout-sheet-kit
npm install react-native-dotenv
npx expo install expo-notifications
```

### 4.2 White-Label Configuration System

Convert `app.json` to `app.config.js`:

```javascript
import 'dotenv/config';

const TENANT = process.env.TENANT || 'default';

// Load tenant-specific config
const tenantConfig = {
  takeabreak: {
    name: 'Take A Break Spas',
    slug: 'takeabreak',
    bundleId: 'com.hottubcompanion.takeabreak',
    icon: './tenants/takeabreak/icon.png',
    splash: './tenants/takeabreak/splash.png',
    adaptiveIcon: './tenants/takeabreak/adaptive-icon.png',
  },
  default: {
    name: 'Hot Tub Companion',
    slug: 'hottubcompanion',
    bundleId: 'com.hottubcompanion.default',
    icon: './assets/icon.png',
    splash: './assets/splash.png',
    adaptiveIcon: './assets/adaptive-icon.png',
  }
};

const config = tenantConfig[TENANT] || tenantConfig.default;

export default ({ config: expoConfig }) => ({
  ...expoConfig,
  name: config.name,
  slug: config.slug,
  version: '1.0.0',
  orientation: 'portrait',
  icon: config.icon,
  splash: {
    image: config.splash,
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: config.bundleId,
    infoPlist: {
      NSCameraUsageDescription: 'Used to identify your hot tub model',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: config.adaptiveIcon,
      backgroundColor: '#FFFFFF',
    },
    package: config.bundleId,
  },
  extra: {
    tenantSlug: config.slug,
    apiUrl: process.env.API_URL || 'https://api.hottubcompanion.com',
    tenantApiKey: process.env.TENANT_API_KEY,
    firebaseApiKey: process.env.FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
  ],
});
```

### 4.3 EAS Build Configuration

Create `eas.json`:

```json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_VARIANT": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "APP_VARIANT": "preview"
      }
    },
    "production": {
      "env": {
        "APP_VARIANT": "production"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json"
      }
    }
  }
}
```

### 4.4 Project Structure

```
/mobile
  /app                     # Expo Router file-based routing
    _layout.tsx            # Root layout with navigation
    index.tsx              # Landing/splash redirect
    /auth
      login.tsx
      register.tsx
      forgot-password.tsx
    /(tabs)                # Main tab navigation (after auth)
      _layout.tsx          # Tab bar configuration
      home.tsx             # "My Tub" dashboard
      shop.tsx             # Product browsing
      services.tsx         # Service requests
      profile.tsx          # Account settings
    /onboarding
      spa-registration.tsx
      sanitization-select.tsx
      welcome.tsx
  /components
    /ui                    # Reusable UI components
      Button.tsx
      Card.tsx
      Input.tsx
      LoadingSpinner.tsx
      Badge.tsx
    /spa                   # Spa-specific components
      SpaCard.tsx
      SpaSelector.tsx
    /shop                  # Shopping components
      ProductCard.tsx
      CartIcon.tsx
  /contexts
    AuthContext.tsx         # Firebase auth state
    TenantContext.tsx       # Tenant config (branding, features)
    CartContext.tsx         # Shopping cart state
    SpaContext.tsx          # Active spa profile
  /services
    api.ts                 # Axios instance with tenant key + auth token
    auth.service.ts        # Firebase auth wrapper
    tenant.service.ts      # Fetch tenant config
    products.service.ts    # Product API calls
    spa.service.ts         # Spa profile CRUD
  /hooks
    useAuth.ts
    useTenant.ts
    useCart.ts
    useActiveSpa.ts
  /theme
    ThemeProvider.tsx       # Dynamic theming from tenant config
    colors.ts              # Default color palette
    typography.ts
    spacing.ts
  /tenants                 # Tenant-specific assets
    /takeabreak
      icon.png
      splash.png
      adaptive-icon.png
      config.env
  /utils
    storage.ts             # Expo SecureStore wrapper
    format.ts              # Price formatting, date formatting
  app.config.js
  eas.json
  package.json
  tsconfig.json
```

### 4.5 API Service Layer

Create an Axios instance that automatically:
- Adds `x-tenant-key` header from tenant config
- Adds `Authorization: Bearer <token>` header when user is authenticated
- Handles token refresh when expired
- Retries failed requests (1 retry with exponential backoff)
- Handles offline state gracefully

```typescript
// services/api.ts
import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({
  baseURL: Constants.expoConfig.extra.apiUrl + '/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'x-tenant-key': Constants.expoConfig.extra.tenantApiKey,
  },
});

// Request interceptor: attach auth token
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('firebase_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle errors
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired — trigger re-auth
      // Emit event that AuthContext listens for
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
```

### 4.6 Tenant Context & Theming

On app launch:
1. App reads `tenantApiKey` from Expo Constants (baked in at build time)
2. Calls `GET /api/v1/tenant/config` to fetch runtime configuration
3. Stores config in TenantContext
4. ThemeProvider reads branding from TenantContext and provides colors/fonts to all components

This means the app loads with a brief splash screen while fetching tenant config, then applies the retailer's branding globally.

### 4.7 Auth Context

Manages Firebase auth state:
1. On mount, check for existing Firebase session
2. If authenticated, verify token with backend (`POST /api/v1/auth/verify`)
3. If verified, fetch user profile and spa profiles
4. If user has no spa profiles, redirect to onboarding
5. If user has spa profiles, redirect to home (My Tub dashboard)
6. Provide `login()`, `register()`, `logout()`, `resetPassword()` functions

---

## Part 5: Next.js Dashboard

### 5.1 Initialize the Project

```bash
cd dashboard/
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
```

Install dependencies:
```bash
npm install axios firebase zustand @tanstack/react-query
npm install @headlessui/react @heroicons/react
npm install date-fns
```

### 5.2 Project Structure

```
/dashboard
  /src
    /app
      layout.tsx              # Root layout
      page.tsx                # Landing redirect
      /auth
        /login
          page.tsx            # Admin login
      /admin                  # Retailer admin routes
        layout.tsx            # Admin layout with sidebar
        /dashboard
          page.tsx            # Overview/home
        /customers
          page.tsx
        /orders
          page.tsx
        /products
          page.tsx            # View products, hide/show, mapping tool
        /services
          page.tsx
        /content
          page.tsx
        /notifications
          page.tsx
        /analytics
          page.tsx
        /settings
          page.tsx
      /super-admin            # TimpCreative routes
        layout.tsx
        /dashboard
          page.tsx
        /tenants
          page.tsx
          /[id]
            page.tsx
        /uhtd
          page.tsx
        /messages
          page.tsx
        /banners
          page.tsx
        /analytics
          page.tsx
    /components
      /ui                     # Shared UI components
        Sidebar.tsx
        Header.tsx
        DataTable.tsx
        Modal.tsx
        Badge.tsx
        Button.tsx
      /admin                  # Retailer admin components
      /super-admin            # Super admin components
    /contexts
      AuthContext.tsx
      TenantContext.tsx
    /services
      api.ts
      auth.service.ts
    /hooks
      useAuth.ts
      useTenant.ts
    /lib
      utils.ts
    /middleware.ts             # Subdomain routing
  tailwind.config.ts
  next.config.js
  package.json
  tsconfig.json
```

### 5.3 Subdomain Routing Middleware

The critical piece: Next.js middleware that reads the subdomain and routes accordingly.

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];

  // Super admin
  if (subdomain === 'admin') {
    // Rewrite to /super-admin routes
    const url = request.nextUrl.clone();
    url.pathname = `/super-admin${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Retailer admin (any other subdomain)
  if (subdomain !== 'www' && subdomain !== 'hottubcompanion' && hostname.includes('hottubcompanion.com')) {
    // Store tenant slug for downstream use
    const response = NextResponse.rewrite(
      new URL(`/admin${request.nextUrl.pathname}`, request.url)
    );
    response.headers.set('x-tenant-slug', subdomain);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### 5.4 Dashboard Auth

Admin users authenticate via Firebase (same as mobile, but on web). After Firebase auth, the dashboard:
1. Sends the Firebase token to the backend
2. Backend verifies token and checks `admin_roles` for the tenant
3. Returns the admin's permissions
4. Dashboard renders only the sections the admin has access to

### 5.5 Dashboard Shell

At the end of Phase 0, the dashboard should have:
- Login page (working with Firebase)
- Sidebar navigation with all menu items (most will show "Coming in Phase X" placeholders)
- Header with retailer branding (fetched from tenant config)
- A basic overview/dashboard page showing "Welcome to [Retailer Name] Admin"
- Super admin: list of tenants, ability to create a new tenant (form that inserts into `tenants` table)

---

## Part 6: Deployment

### 6.1 Railway Deployment

Deploy the API to Railway:

1. In the Railway project, add a new service → "Deploy from GitHub repo" → select `hot-tub-companion` repo → set root directory to `/api`
2. Add a PostgreSQL database service to the project
3. Railway will auto-detect Node.js and build
4. Set environment variables in Railway dashboard (copy from `.env.example`, use production values)
5. Railway provides a `DATABASE_URL` for the PostgreSQL service — reference it in the API service's env vars
6. Set custom domain: `api.hottubcompanion.com`
7. Run migrations: Use Railway's shell or a deploy script that runs `npx knex migrate:latest` on deploy

### 6.2 Dashboard Deployment

Deploy the Next.js dashboard to Vercel (recommended for Next.js) or Railway:

**Vercel (recommended):**
1. Import the GitHub repo, set root directory to `/dashboard`
2. Add wildcard domain: `*.hottubcompanion.com`
3. Set environment variables (API URL, Firebase config)

**Railway (alternative):**
1. Add another service to the Railway project → set root to `/dashboard`
2. Configure custom domain with wildcard

### 6.3 CI/CD

Configure GitHub Actions for:
- **On push to `main`:** Run tests → Deploy API to Railway → Run migrations → Deploy dashboard
- **On push to `develop`:** Run tests → Deploy to staging environment

---

## Part 7: Verification Checklist

Before moving to Phase 1, verify:

- [ ] API health check responds at `https://api.hottubcompanion.com/health`
- [ ] PostgreSQL database is running with core tables created
- [ ] Firebase Auth is working (can create and verify users)
- [ ] Test tenant (TAB) exists in database
- [ ] Mobile app builds and runs on iOS simulator and Android emulator
- [ ] Mobile app successfully fetches tenant config from API
- [ ] Mobile app shows tenant-branded splash screen and theme colors
- [ ] Registration flow works: user can register via mobile app → user appears in Firebase + database
- [ ] Login flow works: user can log in and receive authenticated responses
- [ ] Dashboard loads at `takeabreak.hottubcompanion.com` (or localhost equivalent)
- [ ] Dashboard login works with Firebase
- [ ] Super admin loads at `admin.hottubcompanion.com`
- [ ] Super admin can view and create tenants
- [ ] All environment variables are documented and secrets are not in git
- [ ] README.md exists with setup instructions for new developers
