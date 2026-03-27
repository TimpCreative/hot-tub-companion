# Tenant Mobile Rollout Runbook

This runbook is the required process for shipping app updates safely to multiple tenants.

## 1) Add / verify tenant config entry

Create or update `mobile/tenants/<tenant-key>/tenant.json` with:
- `name`
- `slug`
- `bundleId`
- `icon`, `splash`, `adaptiveIcon`

Local secrets live in **`mobile/.env`** (or optional legacy `tenants/<slug>/config.env` if present), not in git.

Validate:

```bash
cd mobile
npm run tenant:verify
```

## 2) Build config validation per tenant

Resolve Expo config for all tenants:

```bash
cd mobile
npm run tenant:config:all
```

This ensures each tenant resolves independent `name`, `slug`, and `bundleIdentifier`/`package`.

## 3) Device install and identity verification

Install for a tenant:

```bash
cd mobile
TENANT=takeabreak npx expo run:ios --device <DEVICE_ID> --no-bundler
```

Verify installed app identity:

```bash
cd mobile
npm run tenant:verify:device -- <DEVICE_ID> takeabreak
```

## 4) Push token registration checks

1. Login with a customer account in tenant app.
2. Confirm notification permission prompt.
3. Confirm API receives `/users/me/fcm-token` with valid token format.
4. Confirm `users.fcm_token_status` is `ready`.

## 5) Push delivery checks (zero-trust)

For each tenant independently:
- Send a test retailer notification.
- Validate `scheduled_notifications` row has matching `tenant_id`.
- Validate recipient selection query is tenant-scoped.
- Validate `notification_security_audit` contains:
  - `notification_create`
  - `notification_send_tenant`
  - outcome and request attribution (`request_id`, actor, tenant).

## 6) Parallel tenant release process

1. Merge shared code once.
2. Build each tenant artifact independently.
3. Verify identity and push path per tenant.
4. Release tenant artifacts.

Never reuse one tenant binary for another tenant.
