# Hot Tub Companion

White-label mobile and web platform for spa retailers.

## Prerequisites

- **Node.js** 18+
- **Railway CLI** – for local API development with Railway env vars
- **Firebase** – Auth and config
- **Expo CLI** – for mobile development

## Architecture

- **API** (`/api`) – Express + TypeScript + Knex + PostgreSQL; Railway as single source of truth for env vars
- **Mobile** (`/mobile`) – React Native (Expo) white-label app
- **Dashboard** (`/dashboard`) – Next.js retailer admin and super admin

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd hot-tub-companion
npm install
cd api && npm install
cd ../mobile && npm install
cd ../dashboard && npm install
```

### 2. Railway setup (API)

1. Create a Railway project with PostgreSQL
2. Add a Node service with root directory `/api`
3. Add env vars in Railway (no `.env` or `.env.example` for API):

   - `DATABASE_URL` (provided by Postgres)
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
   - `JWT_SECRET`, `ENCRYPTION_KEY`
   - `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
   - `SUPER_ADMIN_EMAILS` (comma-separated – super admin dashboard)
   - `TENANT_ADMIN_EMAILS` (comma-separated – admin whitelist for tenant apps)
   - `API_URL` (e.g. `https://api.hottubcompanion.com`)

4. Link and run locally:

```bash
cd api
railway link
railway run npm run dev
```

### 3. Migrations and seeds

```bash
cd api
railway run npm run migrate
railway run npm run seed
```

After seeding, the console logs the Take A Break tenant `api_key`. Copy it for mobile/dashboard config.

### 4. Mobile

1. Create `mobile/tenants/takeabreak/config.env` from the example (config.env is gitignored):

   ```bash
   cp mobile/tenants/takeabreak/config.env.example mobile/tenants/takeabreak/config.env
   ```

   Then fill in real values (API key from seed output, Firebase keys from Firebase Console).

2. Create `mobile/.env` with `TENANT=takeabreak` (or set when running).

3. Run:

```bash
cd mobile
npx expo start
```

### 5. Dashboard

1. Set env vars (or `.env.local`):

   - `NEXT_PUBLIC_API_URL` – Railway API URL
   - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, etc.
   - `NEXT_PUBLIC_TENANT_API_KEY` – Take A Break tenant key (for retailer admin)

2. Local subdomain testing: use `?tenant=takeabreak` or `?tenant=admin`:

   - `http://localhost:3000/?tenant=takeabreak` → retailer admin
   - `http://localhost:3000/?tenant=admin` → super admin

3. Run:

```bash
cd dashboard
npm run dev
```

## Phase 0 Verification Checklist

- [ ] API health at `/health`
- [ ] Core tables exist, TAB tenant seeded
- [ ] Firebase Auth: register and login work
- [ ] Mobile: builds, fetches tenant config, shows branded theme, registration and login work
- [ ] Dashboard: loads for retailer subdomain and admin subdomain, login works
- [ ] Super admin: can view and create tenants

## Deployment

- **API** – Railway (Postgres + Node service)
- **Dashboard** – Vercel (wildcard domain `*.hottubcompanion.com`)
- **Mobile** – EAS Build

See `.github/workflows/deploy.yml` for CI/CD.
