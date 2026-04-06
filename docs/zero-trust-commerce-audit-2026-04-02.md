# Zero-trust commerce audit — checklist

**Assumption:** Clients, refresh tokens, and webhooks may be hostile. Verify each boundary; record evidence (redacted `curl`, log snippets, screenshots).

| Area | Verify | Status | Evidence / notes |
|------|--------|--------|------------------|
| **Identity** | Firebase ID token verified server-side; user row bound to `tenant_id` + `firebase_uid` | Pass | `authMiddleware` + `users` lookup |
| **Tenant binding** | Commerce routes use `tenantMiddleware` `req.tenant.id`; no authz from body `tenantId` | Pass | Cart, orders, shop routes |
| **Orders API** | `GET /orders` / `by-shopify` scoped to `user_id` + `tenant_id`; admin override → empty list / 404 | Pass | `orders.controller` + `orderReference.service` |
| **Orders abuse** | Rate limit on order reads | Pass | `commerceOrdersReadRateLimiter` on orders routes |
| **Webhooks** | HMAC verified first; idempotency `shopify_webhook_receipts`; shop domain matches tenant | Pass | Existing webhook controller |
| **Secrets** | No raw secrets in API responses; decrypt at use; logs omit tokens | Pass | POS config + adapter logging policy |
| **Cart / Storefront** | Mutations require consumer user; cart id persisted per `(tenant, user)`; checkout URL for session user only | Pass | `cart.controller` + `storefrontCart.service` |
| **Storefront resilience** | 429/5xx retry with backoff, `Retry-After` honored | Pass | `shopifyHttpRetry` in Admin + Storefront GraphQL |
| **Mobile** | Tenant key from build config; TLS to API; minimal PII in logs | Pass | `services/api.ts` |
| **Observability** | Cart Storefront failures logged to `pos_integration_activity` without secrets | Pass | `storefront_cart_mutation_failed` events |

## Pilot QA matrix (Milestone 6)

Execute in staging or controlled production window; link results to `docs/phase3-catalog-qa-playbook.md`.

- [ ] Large catalog pagination / full sync
- [ ] Variants + hidden + OOS + compare-at
- [ ] Invalid variant GID / expired cart / duplicate webhook
- [ ] Client checkout `completed` before webhook (orders appear via webhook SoT)
- [ ] Rate limits (429) after retry layer

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering | | |
| Security / Owner | | |

_This document is a template for formal sign-off; replace Pass with Fail and file remediation tickets when gaps are found._
