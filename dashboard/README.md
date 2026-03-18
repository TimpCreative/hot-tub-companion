# Dashboard (Retailer Admin + Super Admin)

This is the Next.js dashboard for Hot Tub Companion:

- **Retailer admin** experience (tenant-scoped)
- **TimpCreative super admin** experience (UHTD management + multi-tenant ops)

For the full platform overview and local dev instructions (API + mobile + dashboard), see the root `README.md`.

## Local development

Install deps:

```bash
npm install
```

Create `dashboard/.env.local` (do not commit real values):

- `DATABASE_URL` (same Postgres as the API)
- `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:3000`)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (if used)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (if used)
- `NEXT_PUBLIC_FIREBASE_APP_ID` (if used)

Run:

```bash
npm run dev
```

## Local tenant context shortcuts

When running locally (without subdomains), tenant context can be provided via querystring:

- `http://localhost:3000/?tenant=takeabreak` (retailer admin)
- `http://localhost:3000/?tenant=admin` (super admin)
