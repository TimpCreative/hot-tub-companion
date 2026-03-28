# SaaS plans and feature entitlements

This document is the **commercial source of truth** for what each retailer plan includes and how it maps to product behavior. Phase implementation details live in [PHASE-2-CUSTOMER-MVP.md](./PHASE-2-CUSTOMER-MVP.md) through [PHASE-6-SCALE-POLISH.md](./PHASE-6-SCALE-POLISH.md).

Public-facing pricing and comparison: [hottubcompanion.com/plans](https://hottubcompanion.com/plans/).

---

## Plans and upgrades

| Plan | Typical customer |
|------|------------------|
| **Base** | Catalog + checkout + core engagement; no loyalty/points |
| **Core** | Base + services layer, richer comms, loyalty, basic analytics |
| **Advanced** | Core + advanced analytics, bundles shopping UX emphasis, automation/scale features per roadmap |

**Upgrades:** Retailers **contact TimpCreative** (contract / sales). There is **no** in-app self-serve “upgrade and pay” flow implied. After agreement, **Super Admin** applies the appropriate **preset** or adjusts flags.

---

## Data model (target)

- **`saas_plan`** on `tenants`: `base` | `core` | `advanced` | `custom`
  - **`custom`:** contractually unique mix; flags may diverge from any preset (support-driven deals).
- **Feature columns** on `tenants` (booleans / future columns): the **effective** config the API exposes (e.g. via `GET /api/v1/tenant/config` → `features`).
- **Presets** are **defaults** when creating a tenant or when Super Admin clicks **“Apply preset”**. Ongoing behavior is driven by **stored flags**, not by re-deriving from plan on every request (unless you add explicit “enforce preset” maintenance jobs later).

Super Admin should support:

1. Choose **preset** and **apply** (overwrite flags to match that plan’s defaults, with confirmation).
2. **Re-apply preset** (reset drift for tenants not on `custom`).
3. **Per-feature toggles** for overrides and **`custom`** tenants.

An audit log of who changed what is recommended (existing `audit_log` patterns may apply).

---

## Pilot tenant

**Take A Break (TAB)** is on the **Advanced** plan preset for development and QA so the first app exercises the full surface area. Other tenants may start on Base or Core.

---

## Preset → feature matrix (high level)

This aligns with [public Plans](https://hottubcompanion.com/plans/) and current `feature_*` fields in the API ([tenant.service.ts](api/src/services/tenant.service.ts)). Exact column names may expand over time.

| Capability | Base | Core | Advanced | Notes |
|------------|:----:|:----:|:--------:|------|
| Referrals (codes, share, rewards) | ✓ | ✓ | ✓ | Selling point on **all** tiers; implement in Phase 3 after checkout exists. |
| Loyalty / points / redemption at checkout | — | ✓ | ✓ | **Not** Base; Phase 5. |
| Water care assistant | ✓ | ✓ | ✓ | `feature_water_care` |
| Seasonal maintenance timeline | ✓ | ✓ | ✓ | `feature_seasonal_timeline` |
| Subscriptions (internal / Chewy-style) | ✓ | ✓ | ✓ | `feature_subscriptions` |
| Service scheduling / requests | — | ✓ | ✓ | `feature_service_scheduling` |
| Basic manual push | ✓ | ✓ | ✓ | (Further campaign features phased in 4–6.) |
| Scheduled campaigns, inbox, banners (Core on site) | — | ✓ | ✓ | Phase 4 |
| Loyalty + basic analytics + bundles discount (Core+) | — | ✓ | ✓ | Phase 5 |
| Advanced-only roadmap items | — | — | ✓ | See [Phase 6 — Advanced platform capabilities](./PHASE-6-SCALE-POLISH.md#advanced-platform-capabilities-from-public-comparison-table) |

**Core vs Advanced — loyalty depth:** Unless product differentiates later (e.g. redemption caps), **Core** and **Advanced** both use the same default **`feature_loyalty: true`**. Advanced-only perks can be additional flags when defined.

---

## Custom plans

For negotiated deals, set **`saas_plan = custom`** and tune **`feature_*`** explicitly. Presets remain documentation and **“Apply Core + toggle X”** workflows for support.

---

## Super Admin API (entitlements)

Authenticated super-admin routes:

- `GET /api/v1/super-admin/tenants/:id/entitlements` — returns `saasPlan`, effective `features` (boolean map), and `presets` (`base` / `core` / `advanced` defaults for the UI).
- `PUT /api/v1/super-admin/tenants/:id/entitlements` — body JSON:
  - `applyPreset`: `"base"` \| `"core"` \| `"advanced"` — overwrites all `feature_*` columns from the preset and sets `saas_plan` to that value.
  - `saasPlan`: `"base"` \| `"core"` \| `"advanced"` \| `"custom"` — updates the plan label only (use with `features` for custom deals).
  - `features`: partial map of `feature_subscriptions`, `feature_loyalty`, `feature_referrals`, `feature_water_care`, `feature_service_scheduling`, `feature_seasonal_timeline`, `feature_tab_inbox`, `feature_tab_dealer` — merges onto the tenant row.

`GET /api/v1/tenant/config` (customer app) includes `saasPlan` for transparency; **gating** should continue to use `features`.

## Related links

- [PHASE-0-FOUNDATION.md](./PHASE-0-FOUNDATION.md) — infrastructure
- [PHASE-3-ENGAGEMENT.md](./PHASE-3-ENGAGEMENT.md) — commerce, referrals, water care, content, subscriptions
- [PHASE-5-GROWTH.md](./PHASE-5-GROWTH.md) — loyalty, analytics, bundles UX, subscription discounts
