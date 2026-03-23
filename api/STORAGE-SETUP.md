# Firebase Storage Setup for Media Uploads

Media (logos, icons) are served through our **API proxy** at `/api/v1/media/serve`. The bucket stays **private**—no public IAM or CORS config needed.

## Required

1. **FIREBASE_STORAGE_BUCKET** – Set in Railway. New projects: `project-id.firebasestorage.app`; older: `project-id.appspot.com`. If 404 on serve, try the other format.
2. **API_URL** – Base URL of the API (e.g. `https://api.hottubcompanion.com` or `2wb9n1e3.up.railway.app`). `https://` is added if omitted.

The service account (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY) must have Storage Object Admin on the bucket. Firebase projects grant this by default.

## Debugging 404s

To diagnose media serve failures:

1. Set `DEBUG_MEDIA_SERVE=true` in Railway (API service env vars).
2. Redeploy the API.
3. Open in browser: `https://YOUR_API_URL/api/v1/media/debug/MEDIA_ID`
   - Example: `https://2wb9n1e3.up.railway.app/api/v1/media/debug/cacec2b4-3095-4071-9a18-b02bc74372e6`
4. The response shows: DB record (storage_path), path validation, and GCS existence check.
5. Copy the full JSON and share it to debug.

Remove `DEBUG_MEDIA_SERVE` when done.

## How it works

- Uploads: API writes to GCS using the service account.
- Views: Client requests `GET /api/v1/media/serve?path=...` or `GET /api/v1/media/serve/:id`; API streams the file from GCS.
- No `allUsers`, no CORS, no public bucket access. Compatible with domain-restricted sharing.
