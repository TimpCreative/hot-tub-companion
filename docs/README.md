# Hot Tub Companion Docs App

This workspace hosts the Stripe-style technical writing docs site.

## Commands

- `npm run dev` - local docs app at `http://localhost:3100/docs`
- `npm run reference:generate` - regenerate endpoint reference files from API artifacts
- `npm run reference:check` - verify reference parity + required writing metadata
- `npm run reference:refresh` - generate + verify

## Data sources

Reference generation consumes:

- `../api/src/docs/generated/apiInventory.json`
- `../api/src/docs/generated/usageIndex.json`
- `../api/src/docs/generated/openapi.json`

## Serving model

- Public docs: `/docs` (proxied by API using `DOCS_SITE_ORIGIN`)
- Internal explorer: `/internal/docs-explorer`

## Deploying on Vercel (separate project, same repo)

1. **Add New Project** and import this GitHub repo again (second project alongside dashboard).
2. Set **Root Directory** to `docs` (it appears after `docs/` is pushed to GitHub).
3. Framework: Next.js (auto). **Build Command** defaults to `npm run build`, which runs reference generation then `next build`.
4. Deploy and copy the production URL — that value is `DOCS_SITE_ORIGIN` on the API service.

`node_modules/` and `.next/` are gitignored; generated `content/reference/` is rebuilt on each build from committed API JSON under `api/src/docs/generated/`.
