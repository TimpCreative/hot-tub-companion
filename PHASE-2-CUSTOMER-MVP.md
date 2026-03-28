# Phase 2 — Customer App MVP (shipped slice)

**Depends on:** Phase 0 (app shell, auth), Phase 1 (products synced, UHTD populated)
**Unlocks:** [Phase 3 — Engagement](./PHASE-3-ENGAGEMENT.md) for **commerce, home completion, referrals, water care, content, and subscriptions** (see that doc’s *What Phase 3 builds*).
**Estimated effort:** 3–4 weeks *(historical; core slice below is largely complete)*

Commercial entitlements (Base / Core / Advanced presets, manual upgrades, TAB on **Advanced**): [SAAS-PLANS-AND-FEATURES.md](./SAAS-PLANS-AND-FEATURES.md)

---

## Phase 2 Status Review (as of review)

| Area | Status | Notes |
|------|--------|-------|
| **Manual steps** | ⏳ | Needs verification |
| **Registration & login** | ✅ | Done |
| **Spa registration (onboarding)** | ✅ | MVP card flow (SCdb search, Not listed?, consumer suggestions) |
| **Welcome screen** | ✅ | Done |
| **Tab bar (5 tabs)** | ✅ | Home, Shop, Water Care, Inbox, Dealer; Profile in header |
| **Spa selector (multi-spa)** | ❌ | Not implemented; Home uses primary spa only |
| **My Tub dashboard** | ✅ | Hero + spa summary + Quick Links + widgets (dealer_card, tips_list, product_strip) |
| **Quick Links** | ✅ | Refactored from link_tile; configurable, icon/color picker |
| **Info cards** | ❌ | Warranty, Filter Reminder, Seasonal Alert, Recent Orders — none on Home |
| **Shop tab** | ❌ | Placeholder ("Coming in Phase 2"); API exists |
| **Cart & checkout** | ❌ | Not implemented |
| **Push notifications** | ✅ **Done** | Expo Push Token + API registration (all platforms); backend sends via **Expo Push API** or **FCM** by token type; cron dispatch; Admin compose UI; deep links; images; user-local scheduling. *(Retail “all customers” requires a **customer** session — admin/whitelist logins do not register device tokens.)* |
| **Profile & settings** | ✅ | Account, My Spas, notifications, privacy, app info, sign out |
| **Edit spa flow** | ✅ | Sanitization, usage months, serial, nickname, warranty |
| **Retailer Admin app-setup** | ✅ | Onboarding config, home dashboard (Quick Links + widgets), dealer contact |
| **Retailer Admin dashboard UX** | ✅ | Dark/light mode toggle (light default), theme-aware styling, permission system |

### Next work (Phase 3)

All **remaining** customer-app backlog from this file (shop, cart, checkout, home info cards, multi-spa selector, order webhook, Android QA, manual storefront steps) lives under **[Phase 3 — Engagement](./PHASE-3-ENGAGEMENT.md)** — *What Phase 3 builds* and verification checklist there.

**Deferred Phase 1 / production ops** (data volume, production POS sync, correction flows, etc.): [Phase 6 — Deferred Phase 1 and operations verification](./PHASE-6-SCALE-POLISH.md#deferred-phase-1-and-operations-verification-moved-from-phase-2).

---

## Unplanned Changes (Completed)

The following were implemented after the Phase 2 plan and are now complete:

| Change | Status | Notes |
|--------|--------|-------|
| **Push notifications** | ✅ **Done** | `ExponentPushToken[…]` registration to API; server delivery via **expo-server-sdk** + **Firebase Admin** for legacy FCM tokens; cron + Admin compose UI; deep links; images; retailer timezone; user-local send windows. |
| **User-local notification scheduling** | ✅ | Option to send at retailer time or at each user's local time. Past-timezone handling: send immediately or push to next day. |
| **Tenant timezone** | ✅ | Retailer timezone in Admin → Settings. Shown next to "Send At" in Notifications. |
| **Admin permission system** | ✅ | Roles (owner, manager, support, viewer), granular permissions (can_manage_users, can_send_notifications, etc.), Team page with invite/edit/remove, audit log. |
| **Dashboard dark/light mode** | ✅ | Toggle in header (near Sign Out). Light mode default; no system preference. Cookie persistence. Theme-aware cards, inputs, tables (`.card`, `.bg-card`, `.divide-theme`). |

---

## Manual steps (Phase 2)

Phase 2 manual / QA tasks that remain relevant to **shipping the current slice** (branding assets, device testing) are folded into **[Phase 3 — Manual Steps Required](./PHASE-3-ENGAGEMENT.md#manual-steps-required-do-these-first)** alongside checkout and catalog prep.

---

## What Phase 2 delivered (shipped slice)

Phase 2 is treated as **complete** for the following **customer and retailer-admin** capabilities:

- Register and log in (Firebase + tenant context)
- Spa onboarding (SCdb search, Not listed? → consumer suggestions queue, skippable setup)
- Welcome screen and tab shell (Home, Shop placeholder, Water Care, Inbox, Dealer; Profile in header)
- **My Tub** home: hero + spa summary, **Quick Links**, tenant-configurable widgets (`dealer_card`, `tips_list`, `product_strip`), Retailer Admin home editor
- **Push notifications** end-to-end (token registration, Expo/FCM send, cron, Admin compose, deep links, scheduling)
- Profile: account, My Spas, notifications, privacy, app info, sign out; **edit spa** (sanitization, usage months, serial, nickname, warranty)
- Retailer Admin: app setup (onboarding config), home dashboard, dealer contact, team/permissions, dark/light mode, notifications UX

**Not in Phase 2:** in-app shop beyond placeholder, cart/checkout, home **info cards** (warranty / filter / seasonal / orders), **multi-spa** switching on Home/Shop, **orders/create** webhook → customer notification — all **Phase 3**.

---

## Hot tub onboarding (MVP — implemented)

**Skippable first-run setup (Figma-aligned card):**

- **Mobile route:** `/onboarding` — header (tenant logomark, retailer name, “Hot Tub Companion App”, helper copy), white card with **Hot Tub Make** (SCdb brands), **Model** (opens search; user picks a concrete UHTD `scdb_spa_models` row), **Year** (read-only from selected row), **Sanitizer** (from tenant `sanitizationSystems`), primary **Get Started**, unobtrusive **Skip for now**.
- **Not listed?** On make, model, and sanitizer, users can choose **Not listed?** and enter their own details. That flow calls **`POST /api/v1/consumer-uhtd-suggestions`** only: rows go to **`consumer_uhtd_suggestions`** (status `pending`). **Nothing is inserted into SCdb/UHTD** from the app. A **`spa_profile`** is still created with `uhtd_spa_model_id` null and `uhtd_verification_status` = `pending_review` so the customer can use the app while data is verified offline. Super Admin → **Review Queue → Consumer spa requests** lists pending payloads; **PATCH** updates status for workflow only (team still creates/maps the spa in UHTD manually, then links the profile).
- **Entry routing:** After login/register the app hits `/` (`mobile/app/index.tsx`), loads `GET /api/v1/spa-profiles`; if empty and user has not skipped → `/onboarding`; else tabs.
- **Skip:** `AsyncStorage` key `setup_skipped_v1`. While skipped and still no profiles, **Home** and **Shop** show a **Finish setup** banner with **Continue setup** → `/onboarding`. Completing setup removes the skip flag.
- **Customer API:** `GET /api/v1/spa-profiles`, `POST /api/v1/spa-profiles` (Firebase Bearer + `x-tenant-key`). Body includes `uhtdSpaModelId`, `sanitizationSystem`; server fills `brand` / `model_line` / `model` / `year` from SCdb. **`POST /api/v1/consumer-uhtd-suggestions`** — queue-only submission + pending `spa_profile` (see above). Admin override users cannot use these endpoints (403).
- **SCdb:** `GET /api/v1/scdb/brands`, `GET /api/v1/scdb/search?q=&brandId=` (optional `brandId` after make is chosen).
- **Retailer Admin — App setup:** `GET/PUT /api/v1/admin/settings/app-setup` with `can_manage_settings`. Persists `tenants.onboarding_config` (jsonb): `{ version, allowSkip, steps[] }` with step ids `brand`, `modelPick`, `sanitizer`. **`modelPick` is always treated as enabled** in the API normalizer (spa profile requires a UHTD model).
- **Tenant config:** `GET /api/v1/tenant/config` includes `onboarding`, **`homeDashboard`** (normalized from `tenants.home_dashboard_config`), **`dealerContact`** (`public_contact_phone` / `public_contact_address`), and **`features.tabInbox` / `features.tabDealer`** (optional tab visibility; default show). Mobile home renders widgets from `homeDashboard.widgets` with server-side validation and route whitelist.

---

## Part 1: Onboarding Flow

### 1.0 Design System & Branding (Tenant-Aware) — ✅ Implemented

Phase 2 must respect each retailer's branding while keeping the app consistent and accessible. Treat all visual decisions as semantic tokens, not hard-coded colors.

**Tenant branding inputs (configured in Super Admin → Tenants):**
- Primary color (hex) — main brand color.
- Secondary color (hex) — supporting accent color.
- Full logo (horizontal) — used on dealer cards, settings, marketing.
- Logomark (square/icon) — used in app icon, splash, onboarding hero, and small placements.

**Derived palette (computed in mobile app from primary/secondary):**
- `primary`, `primaryLight`, `primaryDark`, `primarySoftBg`
- `secondary`, `secondaryLight`, `secondaryDark`
- `onPrimary`, `onSecondary` (auto-chosen for contrast)
- Neutral tokens: `background`, `backgroundElevated`, `textDefault`, `textMuted`, `divider`

**Light vs dark mode:**
- Respect device-level light/dark preference.
- Light mode: white / light neutrals for backgrounds, `primarySoftBg` for hero panels and cards.
- Dark mode: dark surfaces with `primary`/`secondary` used for strokes, icons, and text accents.
- Do **not** require extra tenant-provided dark colors; derive both schemes from the same primary/secondary.

**Water theme without hard-coding blue:**
- Use soft gradients and shapes that are tinted from the tenant's primary color, instead of fixed blue.
- Ensure all text has sufficient contrast (WCAG AA) against the generated backgrounds.

**Logo usage:**
- Onboarding hero and app splash: use `logo_mark` in a circular or rounded container, with retailer name below.
- Dealer cards and “About / Profile” screens: prefer `logo_full`, fall back to `logo_mark` if full logo missing.
- If no logos are provided, fall back to a generic Hot Tub Companion icon and neutral theme.

**API / data requirements for branding:**
- Tenant record must expose: `primary_color`, `secondary_color`, `logo_full_url`, `logo_mark_url`.
- Super Admin and/or Retailer Admin flows must allow uploading/replacing these assets safely.

### 1.1 Registration Screen — ✅ Implemented

`/auth/register`

**Fields:**
- First Name (required)
- Last Name (required)
- Email (required, validated)
- Password (required, min 8 chars, show/hide toggle)
- Phone Number (optional, formatted input)

**On submit:**
1. Call `POST /api/v1/auth/register`
2. On success, navigate to spa registration onboarding

**Design notes:**
- Show retailer's logo at top of screen (from tenant config)
- Use retailer's primary color for the "Create Account" button
- Link to "Already have an account? Sign In" at bottom

### 1.2 Spa Registration Flow

> **Status:** Superseded by MVP card flow (see "Hot tub onboarding (MVP — implemented)" above). The doc below describes a 7-step wizard; we implemented a single-card flow with SCdb search, Not listed?, and consumer-uhtd-suggestions.

This is a multi-step wizard. The user must complete this before accessing the main app. The registration system should be **easily extensible** — built so that adding new fields later requires minimal code changes.

**Step 1: Select Brand**
- Grid of brand logos/names from `GET /api/v1/uhtd/brands`
- Tappable cards, visually distinct selection state
- "I don't know my brand" link → shows message: "Contact [Retailer Name] at [phone/email] and they can help you identify your spa." with a "Send Email" button that opens the email client pre-filled with the retailer's support email.

**Step 2: Select Model Line**
- Fetches from `GET /api/v1/uhtd/brands/:brandId/model-lines`
- List view with model line names and descriptions
- Back button to return to brand selection

**Step 3: Select Model**
- Fetches from `GET /api/v1/uhtd/model-lines/:modelLineId/models`
- List view showing model name, image thumbnail (if available), discontinued badge
- Shows key specs inline: seating capacity, jet count

**Step 4: Select Year**
- Fetches from `GET /api/v1/uhtd/models/:modelId/years`
- Simple scrollable picker or grid of year buttons
- Most recent year pre-selected

**Step 5: Select Sanitization System**
- Five options displayed as cards with icons and brief descriptions:
  - **Bromine** — "Tablet or granular bromine-based sanitization"
  - **Chlorine** — "Granular dichlor or liquid chlorine"
  - **Frog @Ease** — "SmartChlor mineral cartridge system"
  - **Copper** — "Copper ionizer-based sanitization"
  - **Silver/Mineral Stick** — "Silver ion mineral purifier stick"
- "Not sure which system you use?" link → "Contact [Retailer Name] to find out. You'll need to select a system before you can shop for chemicals." + phone and email buttons
- This selection is critical — it filters all chemical recommendations

**Step 6: Serial Number & Usage (optional, skippable)**
- Serial number text input: "You can find this on a sticker on your spa's equipment compartment"
- Seasonal usage: "Which months do you plan to use your tub?" — 12 month toggle buttons, all ON by default. User can toggle off months they winterize.
- "Skip for now" button — these can be added later in profile settings

**Step 7: Confirmation**
- Summary of all selections: "Your [Brand] [Model] ([Year]) with [Sanitization System]"
- "This looks right" button → calls `POST /api/v1/spa-profiles` → navigates to Welcome screen
- "Let me change something" → goes back to relevant step

### 1.3 Welcome Screen — ✅ Implemented

Brief welcome with retailer branding:
- "Welcome to [Retailer Name], [First Name]!"
- 3 quick value propositions with icons:
  - "🛒 Shop products made for your [Model Name]"
  - "🔧 Schedule service with a tap"
  - "💧 Track your water care"
- "Get Started" button → navigates to main app (tabs)

### 1.4 Spa Registration API — ✅ Implemented

```
POST /api/v1/spa-profiles
  Body: {
    brand: "Jacuzzi",
    modelLine: "J-300 Collection",
    model: "J-335",
    year: 2023,
    sanitizationSystem: "bromine",
    serialNumber: "JAC-335-2023-001234",  // optional
    usageMonths: [1,2,3,4,5,6,7,8,9,10,11,12],  // optional
    uhtdSpaModelId: "uuid-of-matched-model"  // from UHTD selection
  }
  → Returns: created spa profile with ID

GET /api/v1/spa-profiles
  → Returns: all spa profiles for current user (supports multiple spas)

PUT /api/v1/spa-profiles/:id
  → Update spa profile (change sanitization, usage months, serial number, etc.)

DELETE /api/v1/spa-profiles/:id
  → Delete a spa profile (confirm dialog in app)
```

---

## Part 2: Main App Navigation

### 2.1 Tab Bar Layout — ✅ Implemented

After onboarding, the app uses a **bottom tab bar with 5 tabs** (IA-aligned):

| Tab | Label | Screen |
|-----|-------|--------|
| 1 | Home | My Tub / home dashboard (configurable widgets + hero + spa summary) |
| 2 | Shop | Product browsing (MVP placeholder until catalog UI ships) |
| 3 | Water Care | Water care hub (placeholder → Phase 3) |
| 4 | Inbox | Messages (placeholder) — hidden if `features.tabInbox === false` |
| 5 | Dealer | Dealership info (uses `dealerContact` from tenant) — hidden if `features.tabDealer === false` |

**Profile** is **not** a tab: a **header right** control on tab roots (and the Services stack screen) opens **`/profile`**.

**Services** (scheduling / repairs narrative) is a **root Stack** screen at **`/services`**, separate from Water Care — opened from home widgets, dealer CTAs, or deep links; not a sixth tab.

The tab bar uses the retailer's primary color for the active tab indicator.

**Retailer Admin — App setup:** besides onboarding, the **Home dashboard** tab edits `homeDashboard` and dealer public phone/address (`GET/PUT /api/v1/admin/settings/app-setup`).

### 2.2 Spa Selector (Global) — ❌ Not implemented

If the user has multiple spas, a spa selector appears in the header of the Home and Shop tabs. It's a dropdown/pill that shows the active spa's nickname or model name. Tapping it lets the user switch between spas. The selected spa determines what products are shown in Shop and what data displays on the Dashboard.

Store the active spa profile ID in local state (React context) and persist it to `AsyncStorage` so it survives app restarts.

---

## Part 3: My Tub Dashboard (Home Tab) — ✅ Partial

### 3.1 Dashboard Layout

The home screen shows a personalized overview for the active spa. Hero + spa summary + Quick Links + widgets implemented. Info cards (Warranty, Filter Reminder, Seasonal Alert, Recent Orders) not implemented.

**Modularity requirement (important):** Build the My Tub dashboard as a **widget-based, tenant-configurable home screen** (a stack of cards/sections). Dealers should be able to choose which widgets appear, control ordering, and configure basic content/CTAs via Retailer Admin so the home experience feels uniquely *theirs* without shipping new app code.

**Widget system design (implemented v1):**
- **Storage:** `tenants.home_dashboard_config` (jsonb), normalized by API (`homeDashboardConfig.service.ts`).
- **Quick Links (replaces link_tile):** Separate configurable icon tiles with `iconKey`, `targetRoute`, `iconColor`, `iconBgColor`, `quickLinksLayout` (single/double). ✅ Implemented.
- **Mobile registry (fixed types):** `dealer_card`, `tips_list`, `product_strip`. Unknown types are dropped server-side. ~~`link_tile`~~ migrated to Quick Links.
- **`dealer_card`:** uses tenant name + `dealerContact` columns.
- **`tips_list`:** `title`, `items[]` with `{ title, body }`.
- **`product_strip`:** title/subtitle; client loads `GET /api/v1/products` when the user is authenticated (tenant context).
- **Hero + spa summary** are fixed above the widget list on Home (not a configurable widget type in v1).
- Example shape:

  ```jsonc
  {
    "version": 1,
    "quickLinks": [ { "id": "tile_messages", "title": "Messages", "subtitle": "...", "iconKey": "mail", "targetRoute": "/inbox", "enabled": true, "order": 0 } ],
    "quickLinksLayout": "single",
    "widgets": [ { "id": "dealer_card", "type": "dealer_card", ... }, ... ]
  }
  ```

- Retailer Admin UI:
  - Shows available widgets with drag-and-drop ordering and enable/disable toggles.
  - Allows editing text content (titles, subtitles) and selecting from a safe icon set.
  - Allows selecting product sources for `recommendedProducts` (e.g. by category, tag, or curated list).
- The app:
  - Fetches the tenant's `homeLayout` config (with caching and a sensible default if missing).
  - Renders widgets in that order using the registry; unknown/disabled widgets are skipped.
  - Always presents a coherent default layout even if config is empty or misconfigured.

> **Platform compliance note:** This system is configuration-only. Widgets are predefined, compiled components; the server only controls which widgets appear, their order, and their data/content. No executable code or arbitrary HTML is downloaded, keeping the app compliant with Apple/Google store rules.

**Header section:** ✅ Implemented
- Spa model info in hero card (Brand · Model · Year, sanitization)
- ~~Spa model image~~ (not shown; could add)
- Serial number editable in profile, not shown in hero

**Quick Actions:** ✅ Replaced by Quick Links (configurable tiles → Shop, Water Care, Inbox, Dealer, Services, etc.)

**Info Cards (vertical scroll below quick actions):** ❌ Not implemented

1. **Warranty Card** (if warranty expiration date is set)
   - "Warranty Status"
   - Green "Active" badge or red "Expired" badge
   - "Expires: [date]"

2. **Filter Reminder Card**
   - "Last Filter Change: [date]" or "No filter change recorded"
   - "Tap to log a filter change"
   - When tapped, updates `spa_profiles.last_filter_change` to today

3. **Seasonal Alert Card** (conditional)
   - Shows only when a seasonal transition is approaching
   - If current month + 1 is NOT in `usage_months`: "Time to winterize! [Shop winterizing supplies]"
   - If current month - 1 was NOT in `usage_months` but current month IS: "Getting ready for spa season! [Shop startup supplies]"

4. **Recent Orders Card** (if any orders exist — placeholder until checkout is built)
   - Shows last 2 orders with status

---

## Part 4: Product Browsing (moved to Phase 3)

Full specification for Shop, PDP, cart, Checkout Kit, and Storefront API lives in **[Phase 3 — Part 5: Commerce](./PHASE-3-ENGAGEMENT.md#part-5-commerce--product-browsing-shop-tab-cart--checkout)**.

---

## Part 5: Push Notifications (Basic) — ✅ Done (Phase 2)

**Implemented:** After auth (customer accounts), the app requests permission and registers an **Expo push token** (`getExpoPushTokenAsync` with EAS `projectId`). The API stores it in `users.fcm_token` (name is historical) and sends retail pushes via **Expo Push API** or **Firebase Cloud Messaging** depending on token shape. Cron dispatch, Admin Notifications compose UI, deep links, image attachments, and user-local scheduling (vs retailer time) are in place. See `mobile/lib/registerPushToken.ts` and `api/src/services/notification.service.ts` + `expoPushSend.service.ts`.

### 5.1 Client token registration

On app launch (after auth), request notification permissions and register the push token with the API:

```typescript
import * as Notifications from 'expo-notifications';

async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  await api.put('/users/me/fcm-token', { fcmToken: token });
}
```

### 5.2 Backend Notification Service

```typescript
// services/notification.service.ts
import * as admin from 'firebase-admin';

async function sendPushNotification(userId: string, title: string, body: string, data?: object) {
  const user = await getUserById(userId);
  if (!user.fcm_token) return;

  // Check user's notification preferences
  // ... check relevant notification_pref_* field

  await admin.messaging().send({
    token: user.fcm_token,
    notification: { title, body },
    data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
  });

  // Log notification in database
  await db('notifications').insert({
    tenant_id: user.tenant_id,
    user_id: user.id,
    title,
    body,
    type: data?.type || 'general',
    sent_at: new Date(),
  });
}
```

### 5.3 Phase 2 Notifications

Only basic notifications in this phase:
- **Welcome notification:** Sent after registration: "Welcome to [Retailer Name]! Your [Model] is all set up. 🎉"
- **Order confirmation:** Sent when Shopify webhook fires for order creation (requires webhook setup — see below)

### 5.4 Shopify Webhooks

Register Shopify webhooks to get notified of order events:

```
POST /admin/api/2025-01/webhooks.json
{
  "webhook": {
    "topic": "orders/create",
    "address": "https://api.hottubcompanion.com/api/v1/webhooks/shopify/orders",
    "format": "json"
  }
}
```

**Webhook handler endpoint:** `POST /api/v1/webhooks/shopify/orders`
- Verify webhook signature using Shopify's HMAC validation
- Extract order data, match to tenant via Shopify store URL
- Try to match customer email to a user in our database
- If matched: send push notification "Your order #[number] has been placed! 🛒"
- Store order reference in a simple `order_references` table for display on dashboard

---

## Part 6: Profile & Settings (Profile Tab)

### 6.1 Profile Screen — ✅ Implemented

- **Account section:** Name, email, phone, address (editable)
- **My Spas section:** List of registered spas with edit/delete. "Add Another Spa" button.
- **Notification Preferences:** Toggle switches for each notification category (maintenance, orders, subscriptions, service, promotional)
- **Privacy:** Toggle for "Share water test data with [Retailer Name]"
- **App Info:** Version number, terms of service link, privacy policy link
- **Sign Out** button
- **Delete Account** button (with confirmation dialog)

### 6.2 Edit Spa Flow — ✅ Implemented

Tapping a spa in the profile opens an edit screen where the user can change:
- Sanitization system (with warning: "Changing your sanitization system will update your product recommendations")
- Usage months
- Serial number
- Nickname
- Warranty expiration date
- The user CANNOT change brand/model/year inline — they would need to delete and re-register if the spa was entered wrong

---

## Verification Checklist (Phase 2 — shipped slice)

Use this list to confirm the **Phase 2** surface is done. Commerce, home info cards, multi-spa switching, order webhook, and full Android pass are verified in **[Phase 3 verification checklist](./PHASE-3-ENGAGEMENT.md#verification-checklist)**.

_Tenant branding below means **colors + icon URL** from tenant config (`ThemeProvider`, welcome/onboarding); per-tenant typography is not separately configurable in app today._

- [x] New user can register, complete spa onboarding, and land on My Tub dashboard
- [x] Spa registration correctly links to UHTD model (or pending-review path via consumer suggestions)
- [x] My Tub dashboard shows hero + spa summary + Quick Links + configured widgets
- [x] Push notifications are received on device (retailer compose + registered customer token)
- [x] Profile settings are editable and persist
- [x] Spa profile can be edited (sanitization, usage months, serial number, nickname, warranty in edit flow)
- [x] App applies tenant branding (primary/secondary colors, logo/`iconUrl`)
- [x] Retailer Admin can configure onboarding and home dashboard (Quick Links + widgets)

---

### Phase 1 schema & API verification (reference)

The former “Deferred Phase 1” checklist (SCdb/PCdb/comps/Qdb/audit/customer-query APIs, etc.) was validated against **migrations and source**. Anything still open is **data, tenant POS, or product behavior** — see **[Phase 6 — Deferred Phase 1 and operations verification](./PHASE-6-SCALE-POLISH.md#deferred-phase-1-and-operations-verification-moved-from-phase-2)**.
