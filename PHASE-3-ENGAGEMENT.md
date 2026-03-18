# Phase 3 — Engagement & Retention Features

**Depends on:** Phase 2 (working customer app with shopping)
**Unlocks:** Phase 4 (service & communication features)
**Estimated effort:** 3–4 weeks

---

## Manual Steps Required (Do These First)

1. **Write universal water care content.** Create at least 10 guides: first-time fill & startup, weekly water testing basics, bromine maintenance, chlorine maintenance, Frog @Ease maintenance, winterizing your hot tub, spring startup, filter cleaning & replacement, water chemistry troubleshooting, draining & refilling. Written in markdown.

2. **Gather chemical dosage data.** Dosage tables for pH increaser/decreaser, alkalinity increaser, bromine, chlorine, calcium hardness increaser — how much per gallon to adjust by 1 unit. Source from manufacturer labels.

3. **Confirm TAB's subscription preferences.** Does TAB want Shopify Subscriptions (requires an app like Recharge/Bold) or our internal subscription engine?

4. **Design preset bundles with TAB.** Create 3–5 presets: New Owner Starter Kit, Monthly Bromine Pack, Monthly Chlorine Pack, Winterization Kit, Spring Startup Kit.

---

## What Phase 3 Builds

- Water Care Assistant (test logging, chemical recommendations, one-tap purchase)
- Seasonal Maintenance Timeline with push notification triggers
- Content system (universal + retailer-specific, contextual filtering)
- Subscription management (Chewy-style)

---

## Part 1: Water Care Assistant

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

### 2.1 Database Table

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
  linked_product_category VARCHAR(50),  -- UHTD part category to suggest when completing, e.g. 'filter'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_maint_spa ON maintenance_events(spa_profile_id, due_date);
CREATE INDEX idx_maint_pending ON maintenance_events(due_date) WHERE completed_at IS NULL;
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

When regenerating (user changes usage_months), delete all future uncompleted events and recreate. Keep completed events as historical records.

### 2.3 Maintenance Timeline Screen

Accessible from My Tub dashboard or a dedicated section:

**Layout:**
- Overdue section (red): tasks past due date, not completed
- This Week section: tasks due in next 7 days
- Upcoming section: next 30 days, grouped by week
- Each task card: icon by type, title, due date, "Mark Done" button
- On "Mark Done": 
  - Mark event completed
  - If recurring: auto-generate next occurrence
  - Show "Need supplies?" prompt with linked product category → navigates to Shop filtered to that category
  - Update spa_profiles tracking fields (last_filter_change, etc.)

### 2.4 Notification Cron Job

Daily backend cron (runs at 9 AM in user's timezone, or just UTC morning):

```typescript
// Find events needing notification
const events = await db('maintenance_events')
  .where('notification_sent', false)
  .whereNull('completed_at')
  .whereRaw("due_date - (notification_days_before || ' days')::interval <= CURRENT_DATE")
  .whereRaw("due_date >= CURRENT_DATE");

for (const event of events) {
  await sendPushNotification(event.user_id, 
    `Maintenance Reminder`,
    `${event.title} is due ${formatRelativeDate(event.due_date)} for your ${spaModel}.`
  );
  await db('maintenance_events').where('id', event.id).update({ notification_sent: true });
}
```

### 2.5 API Endpoints

```
GET    /api/v1/maintenance?spaProfileId=X&status=pending|completed|overdue&page=1
POST   /api/v1/maintenance/:id/complete
POST   /api/v1/maintenance  (create custom event)
PUT    /api/v1/maintenance/:id
DELETE /api/v1/maintenance/:id  (only custom events)
```

---

## Part 3: Content System

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

### 3.3 Content Screen in App

Add a "Guides" section accessible from My Tub dashboard and as a section within relevant screens:

- **List view:** Cards with thumbnail, title, summary, type badge ("Article" / "Video"), read time
- **Category tabs:** "Getting Started", "Water Care", "Maintenance", "Troubleshooting", "Seasonal"
- **Article detail:** Render markdown body with styled components. Support headings, bold, lists, images, links.
- **Video detail:** Embedded YouTube player (use `react-native-youtube-iframe`)
- **Search:** Search content by title and body text
- **Contextual content:** On Water Care screen, show related water care articles. On Maintenance screen, show related maintenance guides.

### 3.4 Admin Content Management (Dashboard)

`/admin/content` page:

- **List view:** All retailer content + toggle to view universal content
- **Create/Edit form:**
  - Title, type selector (article/video)
  - Body: Markdown editor (use a library like `react-md-editor` or `@uiw/react-md-editor`)
  - Video URL (if type=video)
  - Thumbnail upload (to Firebase Storage)
  - Summary
  - Targeting: brand multi-select, sanitization system multi-select, category multi-select
  - Publish toggle
- **Delete** (retailer's own content only)
- **Hide universal content:** Toggle to suppress specific universal articles for this retailer's customers

### 3.5 API Endpoints

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

## Verification Checklist

Before moving to Phase 4, verify:

- [ ] Customer can log a water test with all parameters
- [ ] Recommendations engine correctly calculates chemical doses based on spa volume and sanitization system
- [ ] Recommendations link to actual purchasable products from the retailer
- [ ] "All good" state displays when levels are in range
- [ ] Water test history shows chronological entries with color coding
- [ ] Trend charts render correctly for 30/60/90 day views
- [ ] Maintenance timeline auto-generates on spa registration
- [ ] Seasonal winterize/startup events generate correctly based on usage months
- [ ] Maintenance notification cron fires and delivers push notifications
- [ ] Completing a maintenance task generates the next recurring instance
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
