# Phase 5 — Growth Features

**Depends on:** Phase 4 (services and communication live)
**Unlocks:** Phase 6 (scale and polish)
**Estimated effort:** 2–3 weeks

---

## Manual Steps Required (Do These First)

1. **Design loyalty program rules with TAB.** Determine: points per dollar spent (e.g., 1 point per $1), redemption rate (e.g., 100 points = $5 credit), any bonus point events (double points on chemicals), expiration policy (points expire after 12 months of inactivity?).

2. **Design referral program terms.** Determine: what reward does the referrer get when their friend buys a hot tub? (e.g., $100 store credit). Does the referred customer get anything? What counts as a qualifying purchase? How is attribution tracked?

3. **Define the key metrics TAB wants to see.** Walk through the analytics dashboard with them and confirm which metrics matter most, what date ranges they want, and any specific reports.

---

## What Phase 5 Builds

- Loyalty/rewards program
- Referral program
- Analytics dashboards (retailer + TimpCreative super admin)
- Recommended bundles system
- Subscription discount configuration

---

## Part 1: Loyalty & Rewards Program

### 1.1 Database Tables

```sql
CREATE TABLE loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'member',  -- future: 'member','silver','gold','platinum'
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_account_id UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,  -- 'earn' | 'redeem' | 'expire' | 'adjust'
  points INTEGER NOT NULL,  -- positive for earn, negative for redeem/expire
  description VARCHAR(500),
  reference_type VARCHAR(30),  -- 'order' | 'referral' | 'manual' | 'signup_bonus'
  reference_id VARCHAR(255),  -- order ID, referral ID, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_loyalty_txn_account ON loyalty_transactions(loyalty_account_id, created_at DESC);

CREATE TABLE loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  points_per_dollar INTEGER DEFAULT 1,  -- points earned per $1 spent
  redemption_rate_points INTEGER DEFAULT 100,  -- points needed
  redemption_rate_value INTEGER DEFAULT 500,  -- cents received (e.g., 100 pts = $5.00)
  signup_bonus_points INTEGER DEFAULT 0,
  min_redemption_points INTEGER DEFAULT 100,
  points_expiry_months INTEGER,  -- null = never expire
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 Earning Points

Points are earned when an order is completed through the app:

1. Shopify `orders/paid` webhook fires
2. Match order to a user via email
3. Calculate points: `order_total_cents / 100 * points_per_dollar`
4. Create loyalty_transaction with type='earn'
5. Update points_balance and lifetime_points
6. Send push notification: "You earned [X] points on your order! Balance: [Y] points 🎉"

**Signup bonus:** If `signup_bonus_points > 0`, award points when a user completes registration:
- Create loyalty_account with initial balance
- Push notification: "Welcome! You've earned [X] bonus points just for signing up!"

### 1.3 Redeeming Points

When the customer has enough points, they can redeem for store credit:

- On the Loyalty screen, show "Redeem [X] points for $[Y] credit" button
- On tap: create a Shopify discount code (using Admin API `POST /admin/api/2025-01/price_rules.json` + `discount_codes.json`) with the credit amount, single-use, tied to the customer's email
- Create loyalty_transaction with type='redeem' (negative points)
- Show the discount code to the customer: "Use code [CODE] at checkout for $[Y] off!"
- The discount code is automatically applied in Shopify Checkout

### 1.4 Customer Loyalty Screen

Accessible from Profile tab or My Tub dashboard:

- **Points balance** (large, prominent)
- **Tier status** (future feature — "Member" for now)
- **Earn/redeem summary:** "You earn [X] point per $1 spent. [Y] points = $[Z] credit"
- **Redeem button** (enabled when balance >= min_redemption_points)
- **Transaction history:** List of point activities with date, description, points (+/-)
- **Active discount codes** (if any unredeemed codes exist)

### 1.5 Points Expiration Cron

If `points_expiry_months` is set, run monthly:
1. Find loyalty_transactions where type='earn' and created_at < (now - expiry_months) that haven't been offset by a redeem/expire transaction
2. Calculate expired points
3. Create loyalty_transaction with type='expire'
4. Update balance
5. Notify customer if points are about to expire (30 days before): "You have [X] points expiring next month. Redeem them before [date]!"

### 1.6 API Endpoints

```
# Customer
GET    /api/v1/loyalty
  → Returns: { balance, lifetimePoints, tier, config }
GET    /api/v1/loyalty/transactions?page=1
POST   /api/v1/loyalty/redeem
  Body: { points }  → Returns: { discountCode, creditAmount }

# Admin
GET    /api/v1/admin/loyalty/config
PUT    /api/v1/admin/loyalty/config
  Body: { pointsPerDollar, redemptionRatePoints, redemptionRateValue, ... }
GET    /api/v1/admin/loyalty/customers?sortBy=balance|lifetime
GET    /api/v1/admin/loyalty/customers/:userId/transactions
POST   /api/v1/admin/loyalty/adjust
  Body: { userId, points, description }  → Manual point adjustment
```

---

## Part 2: Referral Program

### 2.1 Database Tables

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

### 2.2 Referral Flow

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
- This creates a referral record that the retailer can track

**Retailer side:**
- When a referred customer buys a hot tub, the retailer marks the referral as "purchased" in the admin dashboard
- System auto-generates reward (store credit via Shopify discount code or loyalty points)
- Notifies referrer: "Your referral [Name] made a purchase! You've earned $[X] in store credit! 🎉"

### 2.3 API Endpoints

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

## Part 3: Analytics Dashboards

### 3.1 Retailer Analytics (`/admin/analytics`)

**Overview cards (top of page):**
- Total Revenue Through App (last 30 days / all time)
- Active App Users (logged in within last 30 days)
- Total Orders (last 30 days)
- Average Order Value
- Active Subscriptions
- Service Requests (last 30 days)

**Charts:**
- **Revenue over time:** Line chart, daily/weekly/monthly granularity, date range selector
- **Orders over time:** Bar chart
- **Top products:** Horizontal bar chart of top 10 purchased products
- **Customer growth:** Line chart of cumulative registered users over time
- **Subscription metrics:** Active vs paused vs cancelled (pie chart), retention rate over time

**Tables:**
- **Recent orders:** Last 20 orders with customer name, total, date, status
- **Active subscriptions:** List with customer, items, frequency, next delivery
- **Water test activity:** Count of tests logged (if retailer cares about engagement)

**Data sources:** All metrics computed from our database tables. Revenue comes from order references (stored when Shopify webhooks fire). We do NOT query Shopify for analytics — we use our own tracked data.

### 3.2 Super Admin Analytics (`/super-admin/analytics`)

**Platform-wide overview:**
- Total Active Retailers
- Total Registered Customers (across all retailers)
- Platform GMV (gross merchandise value — total order value across all retailers, last 30 days / all time)
- Total Active Subscriptions (platform-wide)

**Per-retailer health metrics table:**
- Retailer name, status, active users, orders (30d), revenue (30d), last product sync, subscription count
- Sortable columns, search by retailer name
- Click retailer → detail page with that retailer's full analytics

**UHTD coverage stats:**
- Brands with 0 models
- Models with 0 compatible parts
- Total mapped products vs unmapped across all retailers

### 3.3 Analytics API Endpoints

```
# Admin
GET /api/v1/admin/analytics/overview?dateFrom=X&dateTo=X
GET /api/v1/admin/analytics/revenue?granularity=day|week|month&dateFrom=X&dateTo=X
GET /api/v1/admin/analytics/orders?granularity=day|week|month&dateFrom=X&dateTo=X
GET /api/v1/admin/analytics/top-products?limit=10&dateFrom=X&dateTo=X
GET /api/v1/admin/analytics/customers?metric=growth|active&dateFrom=X&dateTo=X
GET /api/v1/admin/analytics/subscriptions

# Super Admin
GET /api/v1/super-admin/analytics/overview
GET /api/v1/super-admin/analytics/retailers
GET /api/v1/super-admin/analytics/uhtd-coverage
```

### 3.4 Analytics Data Tracking

To power analytics without querying external APIs:

#### Table: `order_references`
```sql
CREATE TABLE order_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  shopify_order_id VARCHAR(255) NOT NULL,
  order_number VARCHAR(50),
  total_cents INTEGER NOT NULL,
  subtotal_cents INTEGER,
  tax_cents INTEGER,
  shipping_cents INTEGER,
  item_count INTEGER,
  status VARCHAR(30),  -- 'paid','fulfilled','refunded','cancelled'
  placed_at TIMESTAMPTZ NOT NULL,
  source VARCHAR(20) DEFAULT 'app',  -- 'app' | 'subscription'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, shopify_order_id)
);
CREATE INDEX idx_orders_tenant_date ON order_references(tenant_id, placed_at DESC);
```

Populated by Shopify order webhooks. This gives us enough data for analytics without storing sensitive order details.

---

## Part 4: Recommended Bundles

### 4.1 Bundle Display in App

Bundles were defined in Phase 3 (subscription_bundles table). Now we build the full shopping experience:

**Bundle browsing screen** (accessible from Shop tab or a "Bundles" section on home):
- Card per bundle: image, name, description, estimated price, "View Bundle" button
- Filtered by user's sanitization system
- Tap → bundle detail screen:
  - List of products in bundle (resolved to actual retailer inventory)
  - Individual prices + bundle total
  - "Subscribe" button (creates subscription)
  - "Buy Once" button (adds all items to cart)

**Home screen note:** If shown on the My Tub dashboard, the "Bundles" section should be a **widget** so each dealer can choose whether it appears and where it sits in their home layout.

**Admin bundle management** (added to `/admin/products` or dedicated `/admin/bundles`):
- Create custom bundles for their store
- Select products from their inventory
- Set a display image and description
- Target specific sanitization systems
- Activate/deactivate

---

## Part 5: Subscription Discount Configuration

### 5.1 Admin Discount Settings

In `/admin/settings/subscriptions`:

- **Global subscription discount:** e.g., "10% off all subscription orders"
- **Per-product discount override:** Set different discount for specific high-margin or promotional products
- Discounts are applied when creating the Shopify checkout for subscription deliveries
- Display on product cards in app: "Subscribe & Save 10%"

The `subscriptions.discount_percentage` field (from Phase 3) is populated based on these settings when a subscription is created.

### 5.2 API Endpoints

```
GET    /api/v1/admin/subscription-config
PUT    /api/v1/admin/subscription-config
  Body: { defaultDiscountPercentage, productOverrides: [{ posProductId, discountPercentage }] }
```

---

## Verification Checklist

Before moving to Phase 6, verify:

- [ ] Loyalty accounts are auto-created on registration (with signup bonus if configured)
- [ ] Points are earned on order completion via Shopify webhook
- [ ] Points balance and transaction history display correctly in app
- [ ] Redemption generates a working Shopify discount code
- [ ] Points expiration works (if configured)
- [ ] Admin can view loyalty leaderboard and manually adjust points
- [ ] Referral codes are auto-generated per user
- [ ] Referral share functionality works (copy, native share sheet)
- [ ] Referral submissions appear in admin dashboard
- [ ] Marking a referral as "purchased" triggers reward issuance and notification
- [ ] Retailer analytics dashboard shows all metrics with correct data
- [ ] Charts render correctly with date range filtering
- [ ] Super admin analytics shows platform-wide and per-retailer metrics
- [ ] UHTD coverage stats are accurate
- [ ] Bundles display correctly filtered by sanitization system
- [ ] "Buy Once" adds all bundle items to cart
- [ ] "Subscribe" creates a subscription from bundle items
- [ ] Subscription discounts are configurable and applied correctly
