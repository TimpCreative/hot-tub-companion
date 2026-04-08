# Phase 3 — Engagement & Retention Features

**Depends on:** [Phase 2](./PHASE-2-CUSTOMER-MVP.md) (auth, onboarding, My Tub shell, push, retailer admin basics). **Shopping is delivered in this phase**, not a prerequisite.
**Unlocks:** Phase 4 (service & communication features)
**Estimated effort:** 6–8 weeks *(commerce + engagement + referrals — revise as you track velocity)*

**Plans / entitlements:** [SAAS-PLANS-AND-FEATURES.md](./SAAS-PLANS-AND-FEATURES.md) (TAB on **Advanced** preset for guinea-pig coverage; referrals on **all** tiers.)

---

## Phase 3 Status Review (current)

| Area | Status | Notes |
|------|--------|-------|
| **Commerce (Shop / cart / checkout)** | ✅ Partial | **Shipped:** Shop, Storefront cart, native Checkout Kit; **verified Apr 2026** test checkout. Detail: [PHASE-3-COMMERCE-IMPLEMENTATION-PLAN.md](./PHASE-3-COMMERCE-IMPLEMENTATION-PLAN.md). Subscriptions / bundles still planned. |
| **Retailer Admin — Products ↔ UHTD mapping** | ✅ Partial | **Shipped:** list enrichment with top suggestion score (tiered % pills), `pcdb_parts` join for mapped part labels, extended list sort (visibility, mapping status, confidence), modal **Product mapping** vs **UHTD Suggestions** with confirm/clear keeping the modal open. See [PHASE-3-COMMERCE-IMPLEMENTATION-PLAN.md § Retailer Admin: Products and UHTD mapping UX](./PHASE-3-COMMERCE-IMPLEMENTATION-PLAN.md#retailer-admin-products-and-uhtd-mapping-ux). **Still open:** performance at very large page sizes (batch/denormalize scores later), optional super-admin deep link to PCdb part. |
| **Referral program** | ❌ | Still planned in this phase |
| **Water Care Assistant** | ✅ Partial | **Shipped (Apr 2026):** Super Admin **Water Care** — canonical metrics (scale min/max, default ideals), chemistry profiles + scope mappings (priority tie-break documented in UI), published **test kits** (per-metric help, numeric vs color-assist, **color scale points** `{ spots: [{ value, color, label? }] }`). **Mobile:** Water Care tab (resolved profile, comparison vs latest test), **log test** with profile-driven measurements, optional kit picker, dosage **recommendations** on save, list/history via **Maintenance log** / water-tests API. **Still open vs Part 1 spec:** fixed pH/slider UI, trend charts, color-assist entry from kit spots on device, recommendation → **Add to cart** product cards, retailer admin for opted-in shared tests, full `chemical_dosage_rules` breadth. |
| **Seasonal maintenance timeline** | ✅ Shipped | **Care schedule** (`maintenance-timeline`), auto schedule + custom tasks, push cron, spa usage months / winter strategy (onboarding + edit), completing tasks updates `spa_profiles` tracking (`last_filter_change`, `last_water_test_at`, `last_drain_refill_at`, `last_cover_check_at`), Home **maintenance_summary** widget, guides surfacing, unit tests in `api` (`npm test`). **Time v1.1:** due dates + cron use **UTC calendar**; tenant/user TZ later. **Ops:** schedule `POST /api/v1/internal/cron/maintenance-reminders` daily with `CRON_SECRET` (same as other internal crons; e.g. Railway Cron). |
| **Content system** | ✅ Partial | Core universal + retailer content platform is shipped; contextual recommendation/search refinements remain |
| **Subscription management** | ❌ | Still planned in this phase |
| **Cross-platform QA** | ⏳ | Ongoing as features ship |

### Next steps (Phase 3 — suggested order)

1. **Commerce backend:** product sync pagination/retry, `order_references` from `orders/create`, Storefront variant GID normalization, read APIs for shop/PDP — [PHASE-3-COMMERCE-IMPLEMENTATION-PLAN.md](./PHASE-3-COMMERCE-IMPLEMENTATION-PLAN.md#recommended-delivery-order).
2. **Customer app:** read-only Shop, PDP, multi-spa selector, then cart + Checkout Kit, then Home orders card.
3. **Pilot prep:** TAB catalog QA, webhook/order idempotency extensions if needed, manual checklist (#1–4 in *Manual Steps Required* below).
4. **Engagement streams:** referrals, **water care polish** (charts, shop links, mobile color-assist), subscriptions — seasonal timeline is shipped; referrals/bundles ordering per commerce doc.

### Content shipped from this phase

- Super Admin **Content Library** and retailer **Content** management screens are live
- Universal + retailer-authored content supports targeting, categories, suppression, and publish workflows
- Mobile app renders content detail and list surfaces from tenant-aware content APIs

### Water Care shipped from this phase (partial — Apr 2026)

- Super Admin **Water Care** (`/super-admin/uhtd/water-care`): metric library with **scale bounds** and default ideals, profiles, mappings (priority tie-break: higher wins among ties), test kits with **color scale points** for color-assist metrics
- Customer **Water Care** + **Test Water** flows: resolved chemistry profile, comparison row, logging tests, post-save dosage recommendations; kits and legal/disclaimer config from tenant/API

---

## Manual Steps Required (Do These First)

**Commerce / pilot (from former Phase 2 manual checklist)**

1. **Obtain TAB's branding package.** Primary logo (SVG/PNG, light and dark), brand colors (hex), preferred font or approved fallback, app icon, splash. Place under `/mobile/tenants/<slug>/` as needed.

2. **Set up Shopify Checkout Kit.** In TAB's Shopify admin: checkout configured; Storefront API scopes include `unauthenticated_read_checkouts` and `unauthenticated_write_checkouts`; Storefront access token available to the app (see Phase 1).

3. **Create test customer accounts.** 3–5 accounts with different spa models and sanitization systems.

4. **Confirm sufficient UHTD / POS mapping** (e.g. at least ~10 mapped products per test model) so compatible and browse flows have real data.

**Engagement**

5. **Write universal water care content.** At least 10 guides: first-time fill & startup, weekly water testing basics, bromine/chlorine/Frog @Ease maintenance, winterizing, spring startup, filter cleaning & replacement, chemistry troubleshooting, draining & refilling — markdown.

6. **Gather chemical dosage data.** Dosage tables for pH, alkalinity, sanitizer, calcium — per gallon per unit; source from manufacturer labels.

7. **Confirm TAB's subscription preferences.** Shopify Subscriptions (Recharge/Bold, etc.) vs internal subscription engine.

8. **Design preset bundles with TAB.** 3–5 presets: New Owner Starter Kit, Monthly Bromine/Chlorine packs, Winterization, Spring Startup, etc.

**Referrals (all tiers)**

9. **Define referral program terms with TAB.** Referrer reward, optional referred reward, qualifying purchase definition, attribution — see [Part 6: Referral Program](#part-6-referral-program).

---

## What Phase 3 Builds

Work is grouped **below** for clarity; later parts of this document retain detailed specs.

1. **Commerce (former Phase 2 scope)**  
   Shop tab: compatible + browse-all modes, category pills, search, PDP, cart (Shopify Storefront), **Shopify Checkout Kit**, sanitization-aware product filtering as specified.  
   **Multi-spa selector** on Home and Shop with persistent active spa (extends [Phase 2 Part 2](./PHASE-2-CUSTOMER-MVP.md#part-2-main-app-navigation)).  
   **Home info cards:** warranty, filter reminder, seasonal alert, recent orders — [Phase 2 Part 3](./PHASE-2-CUSTOMER-MVP.md#part-3-my-tub-dashboard-home-tab---partial).  
   **Orders:** Shopify `orders/create` webhook → validated handler, push notification, `order_references` (or equivalent) — [Phase 2 Part 5 §5.4](./PHASE-2-CUSTOMER-MVP.md#54-shopify-webhooks).

2. **Referral program (all SaaS tiers)**  
   Unique codes, share sheet, optional manual referral submission, admin workflow to mark purchased and issue rewards — after purchasable checkout exists. Spec: [Part 6](#part-6-referral-program).

3. **Water Care Assistant**  
   Test logging, recommendations, purchasable product links.

4. **Seasonal Maintenance Timeline**  
   Push triggers, recurring tasks.

5. **Content system**  
   Core content management is already live (universal + retailer content, targeting, categories, suppression, mobile rendering). Remaining work in this phase is search/recommendation depth and contextual placement refinement.

6. **Subscription management (Chewy-style)**  
   Internal engine, bundles, deliveries — as specified in Part 4 of this doc.

7. **Cross-platform QA**  
   Android verification alongside iOS for new surfaces.

---

## Part 1: Water Care Assistant

> **Implementation status (Apr 2026):** Runtime uses **profile-linked measurements** and `water_tests` / `water_test_measurements` (not the single-row `ph` / `total_alkalinity` columns shown in the sketch below). Super Admin owns metrics, profiles, mappings, and kits; the mobile app submits dynamic `measurements[]` and receives `recommendations[]`. Treat the SQL in §1.1 as an early shape reference; follow migrations in `api/migrations` for truth.

### 1.1 Database Tables

#### Table: `water_tests`
```sql
CREATE TABLE water_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  spa_profile_id UUID NOT NULL REFERENCES spa_profiles(id) ON DELETE CASCADE,
  ph DECIMAL(4,2),
  total_alkalinity INTEGER,
  sanitizer_level DECIMAL(4,2),
  calcium_hardness INTEGER,
  total_dissolved_solids INTEGER,
  water_temperature DECIMAL(5,2),
  shared_with_retailer BOOLEAN DEFAULT false,
  notes TEXT,
  tested_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_water_tests_spa ON water_tests(spa_profile_id, tested_at DESC);
CREATE INDEX idx_water_tests_tenant_shared ON water_tests(tenant_id) WHERE shared_with_retailer = true;
```

#### Table: `chemical_dosage_rules`
```sql
CREATE TABLE chemical_dosage_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter VARCHAR(30) NOT NULL,  -- 'ph_up','ph_down','alkalinity_up','alkalinity_down','sanitizer','calcium_up'
  sanitization_system VARCHAR(20),  -- null = universal rule
  chemical_type VARCHAR(100) NOT NULL,  -- 'pH Increaser (sodium carbonate)', 'Bromine Tablets'
  dose_per_gallon_per_unit DECIMAL(10,4) NOT NULL,  -- oz per gallon to adjust by 1 unit
  unit_label VARCHAR(20) NOT NULL,  -- 'ppm' or 'pH'
  min_target DECIMAL(6,2) NOT NULL,
  max_target DECIMAL(6,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 Water Test Entry Screen

Accessible from My Tub dashboard "Test Water" quick action.

**Home screen note:** Any new entry points surfaced on the My Tub dashboard in this phase (Water Care, Maintenance Timeline, Guides, Subscriptions) should be implemented as **dashboard widgets** so tenants can customize visibility and ordering.

**Input form fields:**
- **pH:** Slider or numeric stepper, range 6.0–9.0, step 0.1. Show color band (red < 7.2, green 7.2–7.8, red > 7.8)
- **Total Alkalinity:** Numeric input (ppm). Target indicator: 80–120 ppm
- **Sanitizer Level:** Numeric input (ppm). Label changes by system — "Bromine Level" / "Free Chlorine" / etc. Target ranges differ by system (bromine: 3–5 ppm, chlorine: 1–3 ppm, etc.)
- **Calcium Hardness:** Numeric input — in collapsible "Advanced" section. Target: 150–250 ppm
- **Water Temperature:** Numeric input (°F) — in "Advanced" section
- **Notes:** Optional text area

On submit: `POST /api/v1/water-tests` → returns test + recommendations. Navigate to results screen.

### 1.3 Recommendation Engine

After a water test is submitted, the backend computes recommendations:

```typescript
interface Recommendation {
  parameter: string;       // 'ph', 'alkalinity', 'sanitizer', 'calcium'
  currentValue: number;
  targetMin: number;
  targetMax: number;
  status: 'low' | 'high' | 'good';
  action: string;          // "Add 2.5 oz of pH Increaser"
  chemicalType: string;
  dosageOz: number;
  matchingProducts: Product[];  // from retailer's inventory
}
```

**Logic per parameter:**
1. Get spa's water capacity from UHTD model data
2. Get user's sanitization system from spa profile
3. Look up `chemical_dosage_rules` for matching parameter + sanitization system
4. If current value < min_target: calculate dose to reach midpoint = `(midpoint - current) × water_capacity × dose_per_gallon_per_unit`
5. If current value > max_target: calculate inverse dose
6. If in range: status = 'good', no action needed
7. Round dosage to nearest practical measurement (nearest 0.25 oz or nearest teaspoon)
8. Find matching products from retailer's mapped inventory by chemical_type

**Recommendation results screen:**
- Summary card: "2 of 4 levels need attention" or "All levels look great! 🎉"
- For each out-of-range parameter: colored card showing current vs target, dose instruction, product card with "Add to Cart" button
- For each in-range parameter: green checkmark with "✓ pH: 7.4 (Target: 7.2–7.8)"
- "Next recommended test: [7 days from now]" at bottom

### 1.4 Water Test History & Trends

Accessible from a "History" button on the Water Care screen:

- Chronological list of past tests with color-coded indicators per parameter
- Tap to expand: full details + recommendations given
- Trend charts at top: simple line graphs for pH, sanitizer level, alkalinity over last 90 days. Use `react-native-chart-kit` or `victory-native`.
- "Your average pH this month: 7.5" type summary stats

### 1.5 API Endpoints

```
POST   /api/v1/water-tests
  Body: { spaProfileId, ph, totalAlkalinity, sanitizerLevel, calciumHardness, waterTemperature, notes }
  → Returns: { test, recommendations[] }

GET    /api/v1/water-tests?spaProfileId=X&page=1&pageSize=20
GET    /api/v1/water-tests/:id
GET    /api/v1/water-tests/:id/recommendations
GET    /api/v1/water-tests/trends/:spaProfileId?days=90

# Admin (retailers viewing opted-in customer data)
GET    /api/v1/admin/water-tests?customerId=X
  → Only returns tests where shared_with_retailer = true
```

---

## Part 2: Seasonal Maintenance Timeline

> **Note:** The tab **Maintenance Log** in the app is **water test history**. The **mechanical / seasonal schedule** lives on **Care schedule** (`maintenance-timeline` → `GET /maintenance`).

### 2.1 Database Table

`spa_profiles` includes **`winter_strategy`**: `'shutdown' | 'operate'`, default **`operate`** (no winterize/spring pair until the customer opts into shutdown).

`maintenance_events` includes **`source`**: `'auto' | 'custom'`, default **`auto`**. Regenerating the schedule deletes only future **incomplete** rows where **`source = 'auto'`**; completed history and **custom** rows are kept.

```sql
CREATE TABLE maintenance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spa_profile_id UUID NOT NULL REFERENCES spa_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,  -- 'filter_rinse','filter_deep_clean','filter_replace','drain_refill','cover_check','winterize','spring_startup','water_test','custom'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_interval_days INTEGER,
  notification_sent BOOLEAN DEFAULT false,
  notification_days_before INTEGER DEFAULT 3,
  linked_product_category VARCHAR(50),  -- e.g. 'filter','cover','chemical' for shop hints
  source VARCHAR(20) NOT NULL DEFAULT 'auto',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_maint_spa_due ON maintenance_events(spa_profile_id, due_date);
CREATE INDEX idx_maint_notify_pending ON maintenance_events(due_date) WHERE completed_at IS NULL AND notification_sent = false;
```

### 2.2 Auto-Generated Schedule

When a spa profile is created or usage_months change, generate 12 months of maintenance events:

| Event | Frequency | Notification Lead Time | Linked Products |
|-------|-----------|----------------------|-----------------|
| Filter rinse | Every 14 days | 1 day before | filter |
| Filter deep clean | Every 90 days | 3 days before | filter, chemical (filter cleaner) |
| Filter replacement | Every 365 days | 7 days before | filter |
| Drain & refill | Every 90 days | 5 days before | chemical (line flush) |
| Cover condition check | Every 180 days | 3 days before | cover |
| Water test reminder | Every 7 days | 1 day before | chemical |
| Winterize | 14 days before first off-month | 7 days before | chemical (winterizing kit) |
| Spring startup | 7 days before first on-month after gap | 7 days before | chemical (startup kit) |

Skip generating events for months the user has marked as off (except winterize/startup events which specifically target those transitions).

When regenerating (user changes `usage_months` or `winter_strategy`), delete future **auto** uncompleted events from **today onward** and recreate. Keep completed events and **custom** tasks.

**Recurring completion:** `POST /maintenance/:id/complete` sets `completed_at` and, when `is_recurring` is true, inserts the next row with `due_date =` completed date + interval, **snapped to the next in-use month** if that date falls in an off-month (UTC calendar v1).

### 2.3 Maintenance Timeline Screen

Accessible from **Water Care** and the **Care schedule** tab (`maintenance-timeline`).

**Layout (implemented):**
- Overdue section: tasks past due date, not completed
- This week: tasks due in the next 7 days
- Upcoming: next 30 days, **grouped by calendar week** (UTC Monday week start)
- Each task card: **icon by event type**, title, due date, "Mark done"
- **Custom tasks:** add, edit, delete (custom source only); API `POST/PUT/DELETE /maintenance`
- **Guides:** up to two items from content categories `maintenance` and `seasonal`, plus link to Guides with `category=maintenance`
- On "Mark done":
  - Sets `completed_at`; recurring tasks insert the next row (snapped to in-use months)
  - Optional Shop prompt when `linked_product_category` is set
  - Updates **`spa_profiles`** tracking: filter tasks → `last_filter_change`; `water_test` → `last_water_test_at`; `drain_refill` → `last_drain_refill_at`; `cover_check` → `last_cover_check_at` (migration `20260409120000_spa_profiles_maintenance_tracking_at.js`)

**Home dashboard:** Widget type `maintenance_summary` (title + max items) lists pending tasks for the active spa; tenant admins configure it in **App setup** like other home widgets.

**Onboarding:** Catalog spa creation sends optional `usageMonths` and `winterStrategy` so the first schedule matches the customer’s season.

### 2.4 Notification Cron Job

**Route:** `POST /api/v1/internal/cron/maintenance-reminders` (same `CRON_SECRET` / `cronAuth` as other internal crons). Run daily (e.g. Railway cron).

**Selection (UTC calendar dates, v1):** For each row with `completed_at IS NULL` and `notification_sent = false`, let `notify_date = due_date - notification_days_before` (calendar days). Send when **`today >= notify_date` AND `today <= due_date`** (inclusive). This replaces the earlier pseudo-SQL interval cast, which mixed types incorrectly.

**Timezone note (v1.1):** Cron and due-date comparisons use the server’s UTC calendar day. A future revision may align `due_date` and cron “today” to the user’s or tenant’s timezone.

**Delivery:** `notificationService.sendToUser` with **`prefKey: 'maintenance'`** (maps to `users.notification_pref_maintenance`) and FCM data:

`{ linkType: 'maintenance_event', linkId: <event id>, spaProfileId: <spa_profile_id> }`

After a successful send, set `notification_sent = true` on that event.

### 2.5 API Endpoints

```
GET    /api/v1/maintenance?spaProfileId=X&status=pending|completed|overdue&page=1
POST   /api/v1/maintenance/:id/complete
POST   /api/v1/maintenance  (create custom event)
PUT    /api/v1/maintenance/:id
DELETE /api/v1/maintenance/:id  (only custom events)
```

### 2.6 Manual QA (post-deploy)

- Run DB migrations (including `maintenance_events`, `winter_strategy`, `last_drain_refill_at` / `last_cover_check_at`), then open **Care schedule** with an existing spa (lazy schedule generation) or create/edit a spa (eager regeneration).
- **Onboarding:** complete catalog path with custom usage months / winter strategy; confirm first schedule reflects choices.
- Change **usage months** / **winter strategy** on spa edit: future auto tasks refresh; completed rows stay.
- `winter_strategy = shutdown` with at least one off-month → **winterize** / **spring_startup** appear; `operate` → they do not.
- Complete a recurring task → a new pending row appears at the next valid due date (in-use month).
- Complete filter / water test / drain / cover tasks → corresponding `spa_profiles` tracking columns update.
- **Custom task** create → edit → delete → list updates.
- **Home:** with `maintenance_summary` enabled, widget shows pending tasks and opens Care schedule.
- Hit **`POST /api/v1/internal/cron/maintenance-reminders`** daily with `CRON_SECRET` (e.g. Railway Cron); with `notification_pref_maintenance` on, device receives push; tap opens **Care schedule** with optional `eventId` highlight.
- Auth: another user cannot list or complete events for a spa they do not own.
- API: `npm test` in `/api` runs maintenance schedule helper tests.

---

## Part 3: Content System

> **Current status:** The core content platform in this section is already implemented in shipped form: Super Admin Content Library, retailer content management, universal/tenant targeting, category management, suppression, and mobile content rendering are live. Remaining work here should focus on recommendation quality, contextual surfacing, and any follow-on search/ranking improvements.

### 3.1 Database Table

```sql
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = universal
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  type VARCHAR(20) NOT NULL,  -- 'article' | 'video'
  body TEXT,  -- markdown for articles
  summary TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  author VARCHAR(100),
  format VARCHAR(20),  -- for videos: 'masterclass' | 'clip'; null for articles
  transcript TEXT,  -- video transcript used for search and accessibility
  hidden_search_tags TEXT[],     -- backend-only keywords, not shown to customers
  hidden_search_aliases TEXT[],  -- backend-only natural-language phrases / synonyms
  parent_content_id UUID REFERENCES content(id) ON DELETE SET NULL,  -- clip -> masterclass
  target_brands TEXT[],               -- null = all
  target_models TEXT[],               -- null = all
  target_sanitization_systems TEXT[], -- null = all
  target_categories TEXT[],           -- 'new_owner','maintenance','troubleshooting','seasonal','water_care'
  is_universal BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,  -- retailer content: 100, universal: 0
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  read_time_minutes INTEGER,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_content_tenant ON content(tenant_id);
CREATE INDEX idx_content_published ON content(is_published, published_at DESC);
```

### 3.2 Content Retrieval Logic

```typescript
async function getContentForUser(tenantId: string, spaProfile: SpaProfile, filters: ContentFilters) {
  let query = db('content')
    .where('is_published', true)
    .where(function() {
      this.where('tenant_id', tenantId)  // retailer's own content
        .orWhere('is_universal', true);   // universal content
    });

  // Filter by spa brand
  query = query.where(function() {
    this.whereNull('target_brands')
      .orWhereRaw('? = ANY(target_brands)', [spaProfile.brand]);
  });

  // Filter by sanitization system
  query = query.where(function() {
    this.whereNull('target_sanitization_systems')
      .orWhereRaw('? = ANY(target_sanitization_systems)', [spaProfile.sanitizationSystem]);
  });

  // Suppress universal content where retailer has same slug
  // After fetching, deduplicate by slug: keep highest priority version

  return query.orderBy('priority', 'desc').orderBy('published_at', 'desc');
}
```

### 3.2A Video Content Library & Search Strategy

Video content should support both:

- **15-20 minute masterclass videos** that teach a full topic end-to-end
- **1-3 minute quick-reference clips** cut from those masterclasses for in-the-moment help

**Hosting model:**

- YouTube is the primary **video host and playback source** for Phase 3 video content.
- The Hot Tub Companion database is the **source of truth** for all app-facing metadata and search behavior.
- Do **not** rely on YouTube metadata at runtime for title, description, targeting, transcript, or search keywords.
- `video_url` should store the YouTube URL (or canonical provider URL), while metadata such as `title`, `summary`, `transcript`, `hidden_search_tags`, `hidden_search_aliases`, `format`, and targeting fields are authored and maintained in our own admin tools.

The search and recommendation system should assume the customer may **not** know the exact video title. Discovery should therefore rely on a weighted relevance model rather than title match only.

**Backend metadata per video:**

- `title` and `summary` for customer-facing display
- `hidden_search_tags` for backend-only concepts and keywords
- `hidden_search_aliases` for common customer phrasing, synonyms, and misspellings
- `transcript` so spoken phrases are searchable
- `format` so the app can distinguish long-form learning vs quick-help content
- `parent_content_id` so clips can be linked back to a full masterclass

**Examples of hidden metadata:**

- Masterclass: "Water Testing and Logging"
  - Tags: `water testing`, `water balance`, `test strips`, `log water test`, `spa chemistry`
  - Aliases: `how do I test my hot tub water`, `how to record water results`, `how to log strip readings`
- Masterclass: "How a Bromine System Works"
  - Tags: `bromine`, `bromine bank`, `sanitizer`, `oxidizer`, `tablet floater`
  - Aliases: `why is my bromine low`, `how does bromine work`, `how to manage bromine spa`
- Quick clip: "How to Log a Water Test in the App"
  - Linked to its parent masterclass via `parent_content_id`

**Search behavior:**

1. Normalize the query (case-insensitive, punctuation stripped, typo-tolerant where practical).
2. Match across `title`, `summary`, `hidden_search_tags`, `hidden_search_aliases`, and `transcript`.
3. Weight matches by importance:
   - highest: hidden tags / aliases
   - high: title
   - medium: summary
   - lower: transcript
4. Apply contextual boosts:
   - match the user's sanitization system
   - match the active spa profile or relevant category
   - boost quick-reference clips when the user is in a help flow or troubleshooting screen
   - boost masterclasses when the user is browsing educational content intentionally
5. Return a curated result set:
   - best match first
   - then 2-4 related items
   - optionally show the parent masterclass when a clip is returned

**Authoring guidance:**

- Every video should have a clear title, customer-facing summary, transcript, and backend-only search metadata.
- Each video should typically include 10-25 hidden tags and 5-15 aliases.
- Transcript should be required for universal videos whenever practical because it materially improves search quality.
- Tags should cover:
  - topic (`water_testing`, `bromine`, `filter_cleaning`)
  - problem (`low_sanitizer`, `cloudy_water`, `high_ph`)
  - task (`log_test`, `shock_spa`, `adjust_alkalinity`)
  - audience / intent (`beginner`, `quick_help`, `troubleshooting`)
- Tags and aliases are **not** shown in the UI; they exist only to improve search quality and recommendations.
- A clip should normally belong to **zero or one** parent masterclass via `parent_content_id`.

### 3.3 Content Screen in App

Add a "Guides" section accessible from My Tub dashboard and as a section within relevant screens:

- **List view:** Cards with thumbnail, title, summary, type badge ("Article" / "Video"), read time
- **Category tabs:** "Getting Started", "Water Care", "Maintenance", "Troubleshooting", "Seasonal"
- **Article detail:** Render markdown body with styled components. Support headings, bold, lists, images, links.
- **Video detail:** Embedded YouTube player (use `react-native-youtube-iframe`)
- **Search:** Search content by weighted relevance using title, summary, hidden tags, aliases, and transcript text. Do not expose raw keyword lists to customers.
- **Contextual content:** On Water Care screen, show related water care articles and videos. On Maintenance screen, show related maintenance guides. On help and troubleshooting flows, prioritize short clips first and show the related masterclass as a secondary "Learn more" option.

### 3.4 Super Admin Content Library

Add a dedicated **Content Library** section in Super Admin for managing the universal content library used across tenants.

**Purpose:**

- Serve as the source of truth for universal articles, masterclass videos, and quick-reference clips
- Manage all search metadata, transcript content, and parent/child relationships for universal content
- Publish universal content once and make it available to retailer tenants unless explicitly suppressed

**Super Admin Content Library list view:**

- Filters for type (`article` / `video`), format (`masterclass` / `clip`), category, sanitization system, publish status, and universal vs retailer-authored scope
- Search by title, slug, summary, and hidden metadata for admin operations
- Columns/cards for title, type, format, publish status, category, last updated, and usage targeting
- Quick indicator for whether a clip is linked to a parent masterclass

**Super Admin create/edit form:**

- Title
- Slug
- Type selector (`article` / `video`)
- Summary
- Author
- Publish status (`draft` / `published` / `archived`)
- Published date
- Priority
- Targeting: brand multi-select, model multi-select, sanitization system multi-select, category multi-select
- Body markdown editor (articles)
- Video URL (YouTube URL for videos)
- Thumbnail URL or upload override
- Video format (`masterclass` / `clip`)
- Parent masterclass selector (for clips)
- Transcript editor / upload / paste area
- Hidden search tags
- Hidden search aliases

**Behavior rules:**

- Universal video metadata is authored in our database, not pulled live from YouTube at runtime.
- Retailers do not edit universal content directly.
- Universal content can be suppressed per tenant from retailer admin.
- Super Admin may optionally prefill title/thumbnail from a YouTube URL during creation, but the saved DB values remain authoritative after review.

### 3.5 Retailer Admin Content Management

Retailer dashboard `/admin/content` should manage retailer-authored content and how universal content appears for that tenant.

`/admin/content` page:

- **List view:** Retailer-authored content + toggle to view universal content available to that tenant
- **Create/Edit form:**
  - Title, type selector (article/video)
  - Body: Markdown editor (use a library like `react-md-editor` or `@uiw/react-md-editor`)
  - Video URL (if type=video; typically YouTube)
  - Thumbnail upload / URL override
  - Summary
  - Video format: masterclass or clip
  - Parent video selector (for clips derived from a masterclass)
  - Transcript editor / upload
  - Hidden search tags and hidden search aliases (backend-only, not customer-visible)
  - Targeting: brand multi-select, sanitization system multi-select, category multi-select
  - Publish toggle
- **Delete** (retailer's own content only)
- **Hide universal content:** Toggle to suppress specific universal articles or videos for this retailer's customers
- **Optional future enhancement:** Feature/pin selected universal items higher in the tenant experience without modifying the underlying universal record

### 3.6 API Endpoints

```
# Customer
GET    /api/v1/content?spaProfileId=X&category=Y&type=Z&search=Q&page=1
GET    /api/v1/content/:id  (increments view_count)

# Admin
GET    /api/v1/admin/content?includeUniversal=true
POST   /api/v1/admin/content
PUT    /api/v1/admin/content/:id
DELETE /api/v1/admin/content/:id
PUT    /api/v1/admin/content/:id/suppress  (hide universal content for this tenant)

# Super Admin
GET    /api/v1/super-admin/content?type=video&format=masterclass&status=published
POST   /api/v1/super-admin/content  (create universal)
GET    /api/v1/super-admin/content
PUT    /api/v1/super-admin/content/:id
DELETE /api/v1/super-admin/content/:id
```

---

## Part 4: Subscription Management

### 4.1 Two Modes

**Mode A — Shopify-backed:** Retailer has Shopify with subscription capability. We create/manage subscriptions via Shopify's Selling Plan API or partner app API. Billing handled entirely by Shopify.

**Mode B — Internal engine:** We manage the schedule. On each delivery date, we programmatically create a Shopify cart with the subscription items, generate a checkout URL, and either auto-charge (if the retailer's Shopify supports draft orders) or notify the customer to complete checkout. This is more complex but keeps us out of payment processing.

Store mode per tenant: `tenants.subscription_mode = 'shopify' | 'internal'`

### 4.2 Database Tables

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  spa_profile_id UUID REFERENCES spa_profiles(id),

  -- Management
  managed_by VARCHAR(20) NOT NULL DEFAULT 'internal',  -- 'shopify' | 'internal'
  shopify_subscription_id VARCHAR(255),  -- if managed by Shopify

  -- Schedule
  frequency_days INTEGER NOT NULL,  -- 30, 60, 90
  next_delivery_date DATE NOT NULL,
  last_delivery_date DATE,

  -- Items
  items JSONB NOT NULL DEFAULT '[]',
  -- Format: [{ posProductId, posVariantId, title, quantity, priceAtCreation }]

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active','paused','cancelled'
  paused_at TIMESTAMPTZ,
  pause_until DATE,  -- auto-resume date (for seasonal pausing)
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,

  -- Pricing
  discount_percentage DECIMAL(5,2) DEFAULT 0,  -- e.g., 10.00 for 10% off

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_subs_user ON subscriptions(user_id);
CREATE INDEX idx_subs_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subs_next ON subscriptions(next_delivery_date) WHERE status = 'active';

CREATE TABLE subscription_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending','processing','completed','failed','skipped'
  shopify_order_id VARCHAR(255),
  checkout_url TEXT,  -- for internal mode: customer completes this checkout
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_deliveries_sub ON subscription_deliveries(subscription_id);
CREATE INDEX idx_deliveries_pending ON subscription_deliveries(scheduled_date) WHERE status = 'pending';
```

### 4.3 Subscription Customer Experience (Chewy-style)

**Subscribe from product detail page:**
- On compatible products, show "Subscribe & Save" option below "Add to Cart"
- Select frequency: Every 30 / 60 / 90 days
- If retailer offers discount: "Save [X]% with subscription"
- Creates subscription record

**Subscription management screen (accessible from Profile or My Tub):**
- List of active subscriptions with next delivery date
- For each subscription:
  - **View items:** Product names, quantities, prices
  - **Edit items:** Change quantities, swap products (search for compatible alternatives), add/remove items
  - **Change frequency:** 30 / 60 / 90 day selector
  - **Skip next delivery:** Pushes next_delivery_date by one frequency interval
  - **Pause:** Pause indefinitely or until a specific date. For seasonal users: "Pause until [first on-month]" preset button
  - **Resume:** Reactivate a paused subscription, set next delivery date
  - **Cancel:** Confirmation dialog with optional reason. "Are you sure? You'll lose your [X]% subscriber discount."

**Seasonal intelligence:**
- If the user's spa has off-months and they have an active chemical subscription, proactively suggest pausing:
  - Push notification 2 weeks before first off-month: "Winterizing soon? Pause your [Subscription Name] while your tub is closed. [Pause] [Keep Active]"
- Similarly, suggest resuming before the first on-month

### 4.4 Internal Subscription Engine (Cron)

For tenants with `subscription_mode = 'internal'`:

Daily cron job:
1. Find subscriptions where `status = 'active'` AND `next_delivery_date <= today`
2. For each:
   a. Create a `subscription_deliveries` record with status 'processing'
   b. Create a Shopify cart via Storefront API with the subscription items (apply discount if applicable)
   c. Get the checkoutUrl
   d. Send push notification: "Your [Subscription Name] delivery is ready! Complete your order → [deep link to checkout]"
   e. Store checkoutUrl in the delivery record
   f. Update subscription `next_delivery_date += frequency_days`
3. If cart creation fails (product out of stock, etc.), set delivery status to 'failed' and notify customer

**Auto-resume for date-paused subscriptions:**
Daily cron also checks:
```sql
UPDATE subscriptions SET status = 'active', paused_at = NULL
WHERE status = 'paused' AND pause_until IS NOT NULL AND pause_until <= CURRENT_DATE;
```

### 4.5 Subscription Bundles (Presets)

```sql
CREATE TABLE subscription_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = TimpCreative preset
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  items JSONB NOT NULL,  -- [{ uhtdPartCategory, genericPartName, defaultQuantity }]
  target_sanitization_systems TEXT[],  -- which systems this bundle is for
  suggested_frequency_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Bundles are templates. When a customer selects a bundle, the app resolves the generic items to actual products from the retailer's mapped inventory and creates a subscription.

**Bundle screen in app:**
- Shown during onboarding ("Set up automatic deliveries?") and on the Subscriptions page
- Cards for each bundle: name, description, image, estimated monthly cost, "Subscribe" button
- On subscribe: app maps bundle items to retailer products, shows the specific products + prices, customer confirms

### 4.6 API Endpoints

```
# Subscriptions
GET    /api/v1/subscriptions
POST   /api/v1/subscriptions
  Body: { spaProfileId, items[], frequencyDays, discountPercentage? }
PUT    /api/v1/subscriptions/:id
  Body: { items?, frequencyDays? }
POST   /api/v1/subscriptions/:id/pause
  Body: { pauseUntil? }  -- null = indefinite
POST   /api/v1/subscriptions/:id/resume
POST   /api/v1/subscriptions/:id/skip-next
POST   /api/v1/subscriptions/:id/cancel
  Body: { reason? }

# Subscription Bundles
GET    /api/v1/subscription-bundles?sanitizationSystem=bromine
GET    /api/v1/subscription-bundles/:id/resolve?spaProfileId=X
  → Resolves bundle template to actual retailer products for this spa

# Deliveries
GET    /api/v1/subscriptions/:id/deliveries

# Admin
GET    /api/v1/admin/subscriptions?customerId=X&status=active
GET    /api/v1/admin/subscription-bundles
POST   /api/v1/admin/subscription-bundles
PUT    /api/v1/admin/subscription-bundles/:id
DELETE /api/v1/admin/subscription-bundles/:id
PUT    /api/v1/admin/subscriptions/:id/discount
  Body: { discountPercentage }
```

---

## Part 5: Commerce — Product Browsing (Shop Tab), Cart & Checkout

Shop tab currently shows a placeholder until this part is implemented. API exists: `GET /products`, `GET /products/compatible/:spaProfileId`.

### 5.0 Multi-spa, home cards, and order webhook

Deliver alongside or before the Shop UI as needed for pilot QA:

- **Multi-spa selector** on Home and Shop; persist active `spa_profile_id` (see [Phase 2 — Part 2](./PHASE-2-CUSTOMER-MVP.md#part-2-main-app-navigation)).
- **Home info cards:** warranty, filter reminder, seasonal alert, recent orders — [Phase 2 — Part 3](./PHASE-2-CUSTOMER-MVP.md#part-3-my-tub-dashboard-home-tab---partial).
- **Shopify `orders/create` webhook** → HMAC-validated handler, tenant match, user match optional, push + `order_references` — [Phase 2 — Part 5 §5.4](./PHASE-2-CUSTOMER-MVP.md#54-shopify-webhooks).

### 5.1 Shop Screen Layout

**Top section:**
- Search bar (searches product titles and descriptions locally on the fetched data)
- Category filter pills (horizontal scroll): "All", "Filters", "Chemicals", "Covers", "Accessories", etc. — derived from UHTD part categories that have mapped products

**Product grid:**
- 2-column grid of product cards
- Each card shows: product image, product title (truncated), price, "Add to Cart" button
- If inventory_quantity = 0, show "Out of Stock" overlay and disable Add to Cart
- Infinite scroll pagination (20 products per page)

**Two viewing modes:**

1. **"For Your [Model]" (default)** — shows only products compatible with the active spa via UHTD mapping. Uses `GET /api/v1/products/compatible/:spaProfileId`

2. **"Browse All"** — shows all non-hidden products from the retailer. Toggle between modes with a switch/segmented control at top.

### 5.2 Product Detail Screen

When tapping a product card, navigate to a full product detail screen:

- Product image carousel (swipeable, supports multiple images)
- Product title
- Price (formatted: "$29.99")
- Compare-at price with strikethrough if applicable
- Inventory status: "In Stock" (green) or "X left" (orange) or "Out of Stock" (red)
- Product description (rendered from HTML/markdown if applicable)
- Variant selector (if product has variants — e.g., size options for chemicals)
- Quantity selector (default 1, increment/decrement)
- "Add to Cart" button (full width, retailer primary color)
- Compatibility badge: "✓ Compatible with your [Model]" or "ℹ️ General product — check compatibility"
- Related products section at bottom (other compatible products in same category)

### 5.3 Cart

**Cart icon** in the header with badge count showing number of items.

**Cart screen (modal or dedicated screen):**
- List of cart items: image, title, variant, quantity, price, line total
- Quantity adjustable per item (increment/decrement)
- Remove item (swipe-to-delete or X button)
- Subtotal displayed at bottom
- "Proceed to Checkout" button

**Cart state management:**
- Use React Context (`CartContext`)
- Cart is backed by Shopify Storefront API cart objects
- On "Add to Cart": call Shopify Storefront API `cartCreate` mutation (if no cart exists) or `cartLinesAdd` mutation
- Cart ID stored in SecureStore so it persists across sessions
- Cart is tied to the retailer's Shopify store

### 5.4 Checkout via Shopify Checkout Kit

When the user taps "Proceed to Checkout":

1. Retrieve the `checkoutUrl` from the Shopify cart object
2. Call `shopifyCheckout.present(checkoutUrl)` from `@shopify/checkout-sheet-kit`
3. Shopify Checkout Kit presents a native checkout sheet over the app
4. The checkout sheet is fully branded per the retailer's Shopify checkout customization
5. Customer enters shipping info, selects shipping method, enters payment, and completes purchase — all within Shopify's UI
6. Listen for checkout completion events:
   - `completed`: Order placed successfully → show success screen, clear cart, log order reference
   - `cancelled`: User dismissed checkout → return to cart
   - `failed`: Payment failed → show error, return to cart

**Implementation:**

```typescript
import { useShopifyCheckoutSheet } from '@shopify/checkout-sheet-kit';

function CheckoutButton({ checkoutUrl }) {
  const shopifyCheckout = useShopifyCheckoutSheet();

  useEffect(() => {
    if (checkoutUrl) {
      shopifyCheckout.preload(checkoutUrl);
    }
  }, [checkoutUrl]);

  const handleCheckout = () => {
    shopifyCheckout.present(checkoutUrl);
  };

  useEffect(() => {
    const unsubscribeComplete = shopifyCheckout.addEventListener('completed', (event) => {
      clearCart();
      navigation.navigate('OrderConfirmation', { orderId: event.orderDetails?.id });
    });

    const unsubscribeCancel = shopifyCheckout.addEventListener('cancelled', () => {});

    return () => {
      unsubscribeComplete();
      unsubscribeCancel();
    };
  }, []);

  return <Button onPress={handleCheckout} title="Proceed to Checkout" />;
}
```

**For Lightspeed retailers (no Shopify):**
- Option A: Minimal Shopify store for checkout; sync products from Lightspeed.
- Option B: WebView to retailer checkout (less native).
- **TAB:** Prefer Option A where applicable.

### 5.5 Shopify Storefront API Integration

```typescript
// services/shopify-storefront.ts
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: `https://${SHOPIFY_STORE_URL}/api/2025-01/graphql.json`,
  cache: new InMemoryCache(),
  headers: {
    'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
  },
});

const CREATE_CART = gql`
  mutation CreateCart($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart { id checkoutUrl lines(first: 100) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } product { title images(first: 1) { edges { node { url } } } } } } } } } }
    }
  }
`;

const ADD_TO_CART = gql`
  mutation AddToCart($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { id checkoutUrl lines(first: 100) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } } } } } } } }
    }
  }
`;

const UPDATE_CART = gql`
  mutation UpdateCart($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { id checkoutUrl lines(first: 100) { edges { node { id quantity } } } }
    }
  }
`;

const REMOVE_FROM_CART = gql`
  mutation RemoveFromCart($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { id checkoutUrl lines(first: 100) { edges { node { id quantity } } } }
    }
  }
`;
```

**Important:** `merchandiseId` in cart mutations is the Shopify **Storefront** variant GID (`gid://shopify/ProductVariant/...`). Map `pos_products.pos_variant_id` to Storefront GIDs accordingly.

---

## Part 6: Referral Program

**Tiers:** Available on **Base, Core, and Advanced** per [SAAS-PLANS-AND-FEATURES.md](./SAAS-PLANS-AND-FEATURES.md). Implement **after** checkout and order flow exist so attribution and rewards can tie to real purchases.

### 6.1 Database Tables

```sql
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,  -- e.g., "JOHN-TAB-2024"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_referral_code ON referral_codes(code);

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES users(id),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id),
  referred_name VARCHAR(255),
  referred_email VARCHAR(255),
  referred_phone VARCHAR(20),
  status VARCHAR(30) DEFAULT 'pending',  -- 'pending' | 'contacted' | 'purchased' | 'rewarded' | 'expired'
  purchase_date DATE,
  reward_type VARCHAR(20),  -- 'store_credit' | 'loyalty_points' | 'custom'
  reward_amount INTEGER,  -- cents for store credit, points for loyalty
  reward_issued_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE referral_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  referrer_reward_type VARCHAR(20) DEFAULT 'store_credit',
  referrer_reward_amount INTEGER DEFAULT 10000,  -- $100.00 in cents
  referred_reward_type VARCHAR(20),  -- null = no reward for referred
  referred_reward_amount INTEGER,
  qualifying_purchase_description TEXT DEFAULT 'Purchase of a new hot tub',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.2 Referral Flow

**Customer side:**
1. Referral code auto-generated on account creation: `[FIRSTNAME]-[TENANT_SLUG]-[RANDOM4]` (e.g., "JOHN-TAB-A3K9")
2. Referral screen in app (accessible from Profile):
   - "Refer a Friend" heading
   - Explanation: "Know someone who'd love a hot tub? Refer them to [Retailer Name] and earn $[X] in store credit when they purchase!"
   - Referral code displayed large with "Copy" and "Share" buttons
   - Share opens native share sheet with pre-filled message: "I love my [Brand] hot tub from [Retailer Name]! Use my referral code [CODE] when you buy yours. [App download link]"
   - List of past referrals with status

**Manual referral submission (alternative):**
- "Submit a referral" form: referred person's name, email, phone
- Creates a referral record the retailer can track

**Retailer side:**
- When a referred customer buys a hot tub, the retailer marks the referral as "purchased" in the admin dashboard
- System auto-generates reward (store credit via Shopify discount code or loyalty points)
- Notifies referrer: "Your referral [Name] made a purchase! You've earned $[X] in store credit!"

### 6.3 API Endpoints

```
# Customer
GET    /api/v1/referrals/my-code
GET    /api/v1/referrals
POST   /api/v1/referrals
  Body: { referredName, referredEmail, referredPhone }

# Admin
GET    /api/v1/admin/referrals?status=X
PUT    /api/v1/admin/referrals/:id/status
  Body: { status, purchaseDate? }  → If status='purchased', triggers reward
GET    /api/v1/admin/referral-config
PUT    /api/v1/admin/referral-config
```

---

## Verification Checklist

Before moving to Phase 4, verify:

### Commerce, home, and platform

- [ ] Multi-spa: user with multiple spas can switch active spa on Home and Shop
- [ ] My Tub dashboard shows warranty, filter reminder, seasonal alert, and recent orders as specified
- [ ] Shop tab shows products filtered to the user's spa model (compatible mode)
- [ ] Shop tab filters further by sanitization system for chemicals (as specified)
- [ ] "Browse All" mode shows all non-hidden products
- [ ] Category filter pills work correctly
- [ ] Product search works
- [ ] Product detail screen shows full info with images, variants, pricing
- [x] Add to Cart creates/updates a Shopify cart
- [ ] Cart screen shows items, allows quantity changes and removal
- [x] Checkout via Shopify Checkout Kit works end-to-end (test purchase) — verified Apr 2026
- [ ] Order webhook fires and creates a notification (and order reference if applicable)
- [ ] App works on both iOS and Android (full pass on new surfaces)

### Referrals (all tiers)

- [ ] Referral codes are auto-generated per user
- [ ] Referral share functionality works (copy, native share sheet)
- [ ] Referral submissions appear in admin dashboard
- [ ] Marking a referral as "purchased" triggers reward issuance and notification

### Engagement (existing Phase 3 scope)

- [x] Customer can log a water test (**profile-driven** metrics; not the fixed single-row schema in §1.1)
- [x] Recommendations engine returns dosage-style guidance for out-of-range metrics (**spa volume + rules**; breadth of rules still expandable)
- [ ] Recommendations link to actual purchasable products from the retailer
- [ ] "All good" state displays when levels are in range (polish vs per-parameter rec cards)
- [x] Water test history lists past tests (**Maintenance log** / water-tests list; color coding + rich history UI optional)
- [ ] Trend charts render correctly for 30/60/90 day views
- [x] Maintenance timeline auto-generates on spa registration
- [x] Seasonal winterize/startup events generate correctly based on usage months
- [ ] Maintenance notification cron fires and delivers push notifications *(configure host cron; see §2.4 / CREATING-A-NEW-TENANT §9.5)*
- [x] Completing a maintenance task generates the next recurring instance
- [ ] Content displays filtered by spa brand, model, and sanitization system
- [ ] Retailer content takes priority over universal content
- [ ] Video content embeds YouTube correctly
- [ ] Admin can create, edit, delete, and publish content
- [ ] Subscriptions can be created with product selection and frequency
- [ ] Subscriptions can be paused, resumed, skipped, and cancelled
- [ ] Items within a subscription can be swapped or quantity-adjusted
- [ ] Seasonal pause suggestion notification fires at correct time
- [ ] Internal subscription engine creates Shopify carts on delivery dates
- [ ] Subscription bundles resolve to actual retailer products
- [ ] Retailer admin can view subscriptions and configure bundles and discounts
