# Hot Tub Companion

Hot Tub Companion is a **white‑label platform** for spa/hot tub retailers: a customer mobile app (per‑retailer branded builds), a multi‑tenant backend API, and a web dashboard for retailer admins + TimpCreative super admins.

If you’re looking for the detailed build spec, start at `PROJECT-OVERVIEW.md` and the `PHASE-*.md` docs. This README is the “how to run + what’s implemented” reference.

## What’s built (high level)

- **Multi-tenant API (Express + TypeScript + PostgreSQL/Knex)** in `api/`
  - **Tenant resolution** via required `x-tenant-key` header on tenant-scoped routes
  - **Health**: `GET /health`
  - **Auth**: `POST /api/v1/auth/*` (Firebase-backed ID tokens for dashboards; JWT utilities for app workflows)
  - **Tenant config**: `GET /api/v1/tenant/config` (used by the app on launch for branding/features/service types)
  - **UHTD (Universal Hot Tub Database)**: SCdb/PCdb/Qdb + Comps + audit/import tooling under `/api/v1/super-admin/*` and public SCdb reads under `/api/v1/scdb/*`
  - **POS adapter framework** with **Shopify adapter** registered (sync + webhook hooks live behind the adapter interface)
  - **Retailer admin APIs** under `/api/v1/admin/*` (product visibility, mapping workflows, etc.)
  - **Customer product APIs** under `/api/v1/*` (see `api/src/routes/index.ts` for route mounting)

- **Dashboard (Next.js)** in `dashboard/`
  - Retailer admin and super admin views (tenant context via querystring fallback for local dev)
  - UHTD management UI (brands/model lines/spas/parts/comps/qualifiers/import/review queue)

- **Mobile (Expo / React Native)** in `mobile/`
  - White-label tenant configuration via build/runtime config files (tenant assets live under `mobile/tenants/*`)

## Repo layout

```
api/        Express API (TypeScript)
dashboard/  Next.js dashboard (retailer admin + super admin)
mobile/     Expo mobile app (white-label builds)
```

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** (local, Railway, or any hosted Postgres)
- **Firebase project**
  - Firebase Admin credentials for the API
  - Firebase web config for dashboard/mobile auth
- **Expo tooling** (for mobile dev)

## Quick start (local dev)

### Install deps

This is not currently configured as a single “workspace install”, so install per package:

```bash
cd api && npm install
cd ../dashboard && npm install
cd ../mobile && npm install
```

### API

The API reads env vars from the process (and `dotenv` is enabled), so you can use **Railway env vars** or a local `api/.env` (never commit secrets).

#### Required environment variables (API)

- `DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (must include proper newlines; `\n`-escaped is supported)
- `JWT_SECRET`

#### Optional environment variables (API)

- `PORT` (defaults to `3000`)
- `API_URL` (defaults to `http://localhost:3000`)
- `JWT_EXPIRES_IN` (defaults to `7d`)
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL` / `SENDGRID_FROM_NAME`
- `ENCRYPTION_KEY`
- `SUPER_ADMIN_EMAILS` (comma-separated)
- `TENANT_ADMIN_EMAILS` (comma-separated)
- `FIREBASE_STORAGE_BUCKET`
- `DASHBOARD_BASE` (e.g. `https://hottubcompanion.com`; used for admin invite URLs and tenant subdomain derivation)
- `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (optional; API auto-adds `{slug}` retailer hostname to the Vercel dashboard project on tenant create—see `CREATING-A-NEW-TENANT.md`)
- `EAS_BUILD_CONFIG_SECRET` (min 32 chars; mirror the same value in Expo project env vars — EAS builds call `GET /api/v1/internal/eas-tenant-config` to load `tenantApiKey` by tenant slug)

#### Run migrations + seed

```bash
cd api
npm run migrate
npm run seed
```

#### Start the API

```bash
cd api
npm run dev
```

### Dashboard

Create `dashboard/.env.local` (or set env vars in your shell). **Do not commit real values**.

- `DATABASE_URL` (same Postgres the API uses)
- `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:3000`)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (if used)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (if used)
- `NEXT_PUBLIC_FIREBASE_APP_ID` (if used)

Run:

```bash
cd dashboard
npm run dev
```

Local tenant context helpers:

- `http://localhost:3000/?tenant=takeabreak` (retailer admin)
- `http://localhost:3000/?tenant=admin` (super admin)

### Mobile

Tenant builds use tenant-specific config files under `mobile/tenants/<tenant>/`.

```bash
cp mobile/tenants/takeabreak/config.env.example mobile/tenants/takeabreak/config.env
```

Then run:

```bash
cd mobile
npm run start
```

**EAS cloud builds (per retailer):** set `TENANT` to the folder name under `mobile/tenants/` (must match `tenants.slug` in the DB and `status: active`). Expo env needs `API_URL`, `FIREBASE_*`, and `EAS_BUILD_CONFIG_SECRET` (not per-tenant `TENANT_API_KEY`). On the builder, `app.config.js` loads the key via `curl` to `GET /api/v1/internal/eas-tenant-config` (gitignored `config.env` is absent there). Example:

```bash
cd mobile
TENANT=htctest eas build --profile preview --platform android
```

Set the same `EAS_BUILD_CONFIG_SECRET` on Railway and in Expo. If `TENANT_API_KEY` is already in the environment, it is used instead of fetching (handy for local experiments with `EAS_BUILD=1`).

## Tenant + auth model (practical notes)

- **Tenant scoping**: most API routes require `x-tenant-key`. The middleware skips `/health`, `/api/v1/auth/*`, `/api/v1/tenant/config`, `/api/v1/internal/eas-tenant-config`, and all `/api/v1/super-admin/*` routes.
- **Super admin auth**: `/api/v1/super-admin/*` uses Firebase ID tokens + `SUPER_ADMIN_EMAILS` allowlist.

## Deployment (current targets)

- **API**: Railway (Node service + Postgres)
- **Dashboard**: Vercel (supports wildcard subdomains like `*.hottubcompanion.com`)
- **Mobile**: EAS Build (one app listing per tenant)

## Documentation index

- **Project map**: `PROJECT-OVERVIEW.md`
- **UHTD spec**: `UHTD-Architecture-Overview-v2.1.md`
- **Phase specs**: `PHASE-0-FOUNDATION.md` … `PHASE-6-SCALE-POLISH.md`
