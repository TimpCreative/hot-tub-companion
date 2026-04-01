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
- `EXPO_ACCESS_TOKEN` (optional; Expo push notifications work without it for moderate volume—create at [expo.dev](https://expo.dev) → Access tokens if you need higher throughput)

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

Tenant **branding and bundle IDs** live under `mobile/tenants/<tenant>/` (`tenant.json` + assets). **Secrets for local `expo start`** are not stored next to each tenant: use a single gitignored **`mobile/.env`** or pull from Expo:

```bash
cd mobile
eas env:pull --environment development   # writes .env from expo.dev (if configured)
```

Or create **`mobile/.env`** manually (never commit) with at least:

| Variable | Purpose |
|----------|---------|
| `TENANT` | Folder name under `tenants/` (e.g. `htctest`) when not passing `export TENANT=...` |
| `API_URL` | Your API base URL |
| `TENANT_API_KEY` | Tenant mobile key (from Super Admin / DB) |
| `FIREBASE_API_KEY` | Firebase client config |
| `FIREBASE_AUTH_DOMAIN` | Firebase client config |
| `FIREBASE_PROJECT_ID` | Firebase client config |

Optional: a legacy **`mobile/tenants/<tenant>/config.env`** file is still loaded **if present** (also gitignored).

```bash
cd mobile
export TENANT=htctest   # optional if TENANT is in .env
npm run start
```

#### Fresh dev-client scripts

If the iOS dev client shows stale UI, use the fresh-launch scripts instead of a plain `expo start`. These scripts start Metro without `CI`, clear the usual stale-bundle path, and reconnect the dev client cleanly.

Simulator:

```bash
cd mobile
npm run dev:sim:htctest
```

Physical iPhone:

```bash
cd mobile
DEVICE_ID=<your-iphone-udid> npm run dev:device:htctest
```

Notes:

- These npm shortcuts are currently wired for the `htctest` tenant; duplicate the package scripts or call the shell scripts directly if you want the same workflow for another tenant
- `dev:sim:htctest` uses the current default simulator UDID inside `mobile/scripts/dev-sim-reset.sh`
- `dev:device:htctest` prints the dev-client deep link and keeps Metro running for on-device testing
- Both scripts assume the current LAN Metro host baked into the script; update `METRO_HOST` in the script or export it when your local IP changes
- Keep the terminal running while you test; stopping the script stops Metro too

**EAS cloud builds (per retailer):** the **remote builder does not receive** arbitrary shell vars. Use a **named profile** so `env.TENANT` is set on the server. [`mobile/eas.json`](mobile/eas.json) is generated with **`preview-<slug>`** and **`production-<slug>`** for each folder under `mobile/tenants/` that has `tenant.json` (the template `default` tenant is skipped). Regenerate after adding a tenant:

```bash
cd mobile
npm run eas:generate
```

Examples:

```bash
eas build --profile preview-htctest --platform ios
eas build --profile production-takeabreak --platform ios
```

`submit` entries match **`production-<slug>`** for Android (same `serviceAccountKeyPath` as before). Expo env still needs `API_URL`, `FIREBASE_*`, and `EAS_BUILD_CONFIG_SECRET` per environment (`preview` / `production`). On the builder, `app.config.js` fetches the tenant API key from `GET /api/v1/internal/eas-tenant-config`. Set the same `EAS_BUILD_CONFIG_SECRET` on Railway and in Expo. If `TENANT_API_KEY` is already in the environment, it is used instead of fetching (handy for local experiments with `EAS_BUILD=1`).

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
