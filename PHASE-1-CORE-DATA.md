# Phase 1 — Core Data Layer

**Depends on:** Phase 0 (backend running, database schema, auth working)
**Unlocks:** Phase 2 (customer app needs products and UHTD data)
**Estimated effort:** 2–3 weeks

---

## Manual Steps Required (Do These First)

1. **Confirm TAB's POS system.** Contact Take A Break and determine whether they use Lightspeed R-Series, Lightspeed X-Series, or Shopify. Get the exact product name. This determines which API integration to build first.

2. **Get POS API credentials:**
   - **If Shopify:** Go to TAB's Shopify admin → Settings → Apps → Develop Apps → Create App → Configure Storefront API scopes (read products, read product listings, read inventory) AND Admin API scopes (read products, read inventory, read orders, write orders). Install the app and copy both tokens.
   - **If Lightspeed X-Series:** Register at https://x-series-api.lightspeedhq.com/, create an app (Add-on type for multi-retailer use), get client_id and client_secret. Have TAB authorize your app via OAuth flow.

3. **Begin UHTD data collection (parallel track).** Start a spreadsheet with the following columns for each spa model TAB sells:
   - Brand, Model Line, Model Name, Year(s) Available, Water Capacity (gallons), Filter Type/Part Number, Number of Jets, Seating Capacity, Dimensions, Is Discontinued (Y/N)
   - Initial brands: Jacuzzi, Sundance, Hydropool, Endless Pools, Cal Spas, DreamMaker
   - Source this from manufacturer spec sheets, TAB's knowledge, and manufacturer websites

4. **Get a sample of TAB's product catalog.** Ask TAB to export their product list (CSV or screenshot). You need to understand their naming conventions, categories, and how they organize chemicals, filters, covers, accessories, etc. This informs the mapping tool design.

---

## What Phase 1 Builds

At the end of this phase, you should have:

- UHTD database tables populated with initial spa model data (6 brands)
- POS integration that syncs TAB's product catalog into the app's database
- A product sync service that runs on a configurable interval (default: every 30 minutes)
- The UHTD mapping tool in the retailer admin dashboard (map POS products to UHTD compatibility entries)
- Product visibility controls (hide/show products from the app)
- Super admin UHTD management interface

---

## Part 1: UHTD Database Schema

### 1.1 Migration: UHTD Tables

#### Table: `uhtd_brands`
```sql
CREATE TABLE uhtd_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,  -- 'Jacuzzi', 'Sundance', etc.
  logo_url TEXT,
  website_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `uhtd_model_lines`
```sql
CREATE TABLE uhtd_model_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES uhtd_brands(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,  -- 'J-300 Collection', 'J-400 Designer Collection', etc.
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(brand_id, name)
);

CREATE INDEX idx_uhtd_model_lines_brand ON uhtd_model_lines(brand_id);
```

#### Table: `uhtd_spa_models`
```sql
CREATE TABLE uhtd_spa_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_line_id UUID NOT NULL REFERENCES uhtd_model_lines(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES uhtd_brands(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,  -- 'J-335', 'J-345', etc.
  year_start INTEGER NOT NULL,  -- first year this model was available
  year_end INTEGER,  -- null if still in production
  water_capacity_gallons INTEGER,
  jet_count INTEGER,
  seating_capacity INTEGER,
  dimensions_length_inches INTEGER,
  dimensions_width_inches INTEGER,
  dimensions_height_inches INTEGER,
  weight_dry_lbs INTEGER,
  weight_filled_lbs INTEGER,
  electrical_requirement VARCHAR(50),  -- '240V/50A', '120V/15A', etc.
  has_ozone BOOLEAN DEFAULT false,
  has_uv BOOLEAN DEFAULT false,
  image_url TEXT,
  spec_sheet_url TEXT,
  is_discontinued BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_uhtd_models_model_line ON uhtd_spa_models(model_line_id);
CREATE INDEX idx_uhtd_models_brand ON uhtd_spa_models(brand_id);
CREATE INDEX idx_uhtd_models_name ON uhtd_spa_models(name);
```

#### Table: `uhtd_part_categories`
```sql
CREATE TABLE uhtd_part_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,  -- 'filter', 'cover', 'chemical', 'headrest', 'jet', 'pump', 'control_panel', 'cover_lifter', 'steps', 'aromatherapy'
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_name VARCHAR(50),  -- for app UI icon reference
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `uhtd_compatible_parts`
```sql
CREATE TABLE uhtd_compatible_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spa_model_id UUID NOT NULL REFERENCES uhtd_spa_models(id) ON DELETE CASCADE,
  part_category_id UUID NOT NULL REFERENCES uhtd_part_categories(id) ON DELETE CASCADE,

  -- Generic part identification (not tied to a specific retailer)
  generic_part_number VARCHAR(100),  -- e.g., '6000-383A' (ProClarity filter)
  generic_part_name VARCHAR(255) NOT NULL,  -- e.g., 'ProClarity 6000-383A Filter'
  manufacturer VARCHAR(100),  -- e.g., 'Jacuzzi', 'Filbur', 'Pleatco'
  is_oem BOOLEAN DEFAULT false,  -- true if this is the original equipment manufacturer part

  -- For chemicals: which sanitization systems is this compatible with?
  compatible_sanitization_systems TEXT[],  -- e.g., '{bromine,chlorine}' or null if universal

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_uhtd_parts_spa ON uhtd_compatible_parts(spa_model_id);
CREATE INDEX idx_uhtd_parts_category ON uhtd_compatible_parts(part_category_id);
CREATE INDEX idx_uhtd_parts_part_number ON uhtd_compatible_parts(generic_part_number);
```

### 1.2 Seed: Initial UHTD Data

Create seed files for:

1. **Part categories:** filter, cover, chemical, headrest, jet, pump, control_panel, cover_lifter, steps, aromatherapy, pillow, drain_valve, ozonator, circulation_pump
2. **Brands:** Jacuzzi, Sundance, Hydropool, Endless Pools, Cal Spas, DreamMaker
3. **Model lines and models:** Populate from the spreadsheet created in the manual step. Start with Jacuzzi (largest brand TAB carries) and work outward.

This seed data will be incomplete at first. The super admin UHTD management interface (Part 4 below) allows ongoing data entry.

### 1.3 UHTD API Endpoints

These are public (no auth required, only tenant key) because the mobile app needs them during onboarding/registration:

```
GET /api/v1/uhtd/brands
  → Returns: [{ id, name, logoUrl }]

GET /api/v1/uhtd/brands/:brandId/model-lines
  → Returns: [{ id, name, description }]

GET /api/v1/uhtd/model-lines/:modelLineId/models
  → Returns: [{ id, name, yearStart, yearEnd, isDiscontinued }]

GET /api/v1/uhtd/models/:modelId/years
  → Returns: [2024, 2023, 2022, ...] (computed from yearStart/yearEnd)

GET /api/v1/uhtd/models/:modelId
  → Returns: Full model details including waterCapacity, jetCount, specs
```

These endpoints are cascading — the app calls them in sequence as the user selects Brand → Model Line → Model → Year during spa registration.

---

## Part 2: POS Integration Service

### 2.1 POS Adapter Architecture

Build a POS adapter pattern so that Shopify and Lightspeed (and future POS systems) share a common interface:

```typescript
// services/pos/pos-adapter.interface.ts
interface POSAdapter {
  // Connection
  testConnection(): Promise<boolean>;
  refreshToken(): Promise<void>;  // for OAuth-based systems

  // Products
  fetchAllProducts(): Promise<NormalizedProduct[]>;
  fetchProductById(posProductId: string): Promise<NormalizedProduct>;
  fetchProductsSince(lastSyncAt: Date): Promise<NormalizedProduct[]>;

  // Inventory
  getInventoryLevel(posProductId: string): Promise<number>;

  // Orders (for viewing in admin, not creating)
  fetchRecentOrders(limit: number): Promise<NormalizedOrder[]>;
  fetchOrderById(posOrderId: string): Promise<NormalizedOrder>;
}

// Normalized product format (common across all POS systems)
interface NormalizedProduct {
  posProductId: string;
  title: string;
  description: string;
  vendor: string;
  productType: string;  // category
  tags: string[];
  price: number;  // in cents
  compareAtPrice: number | null;
  images: { url: string; position: number }[];
  variants: {
    posVariantId: string;
    title: string;
    price: number;
    sku: string;
    inventoryQuantity: number;
    weight: number;
    weightUnit: string;
  }[];
  status: 'active' | 'draft' | 'archived';
  updatedAt: Date;
}
```

### 2.2 Shopify Adapter

```typescript
// services/pos/shopify-adapter.ts
```

Uses Shopify Admin API (REST or GraphQL) to:

**Fetch products:**
- `GET /admin/api/2025-01/products.json?limit=250` (paginate with `page_info`)
- Normalize each product into `NormalizedProduct` format
- Handle variants (Shopify treats everything as a variant)
- Fetch inventory levels via `GET /admin/api/2025-01/inventory_levels.json`

**Important Shopify details:**
- Rate limit: 40 requests per app per store per minute (REST), 1000 cost points per second (GraphQL). Use GraphQL for bulk fetches.
- Products have a `published_at` field — only sync published products
- Shopify product IDs are numeric strings (e.g., "7654321098765")
- Use `updated_at_min` parameter for incremental syncs

**For checkout (used in Phase 2):**
- Shopify Storefront API for cart creation
- `@shopify/checkout-sheet-kit` for native checkout presentation
- Store the retailer's Storefront access token (encrypted) in the `tenants` table

### 2.3 Lightspeed X-Series Adapter

```typescript
// services/pos/lightspeed-adapter.ts
```

Uses Lightspeed Retail X-Series API:

**Authentication:**
- OAuth 2.0 flow. Store access_token and refresh_token (encrypted) in `tenants` table.
- Token endpoint: `https://<<domain_prefix>>.retail.lightspeed.app/api/1.0/token`
- Access tokens expire. Use `refresh_token` to get new access token before expiry.
- Rate limited independently on token endpoint — only refresh when token is expired or about to expire.

**Fetch products:**
- v2.0 API: `GET /api/2.0/products` — paginate with `after` parameter (version-based pagination)
- Normalize Lightspeed product structure to `NormalizedProduct`
- Lightspeed uses "product" → "variant" hierarchy similar to Shopify
- Inventory is on the variant level

**Key Lightspeed differences from Shopify:**
- Uses domain_prefix for API URL: `https://<<domain_prefix>>.retail.lightspeed.app/api/2.0/`
- Products have `deletedAt` field — skip deleted products
- Prices may include tax depending on store settings
- No built-in checkout flow — for Lightspeed retailers, we may need to use Shopify as a parallel checkout channel or build a different checkout approach (address in Phase 2)

### 2.4 Product Sync Table

#### Table: `pos_products`
```sql
CREATE TABLE pos_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pos_product_id VARCHAR(255) NOT NULL,  -- external ID from Shopify/Lightspeed
  pos_variant_id VARCHAR(255),  -- if this represents a specific variant

  title VARCHAR(500) NOT NULL,
  description TEXT,
  vendor VARCHAR(255),
  product_type VARCHAR(255),  -- category from POS
  tags TEXT[],
  price INTEGER NOT NULL,  -- cents
  compare_at_price INTEGER,
  sku VARCHAR(255),
  images JSONB DEFAULT '[]',  -- [{url, position}]
  variants JSONB DEFAULT '[]',  -- [{posVariantId, title, price, sku, inventoryQuantity}]
  inventory_quantity INTEGER DEFAULT 0,
  weight DECIMAL(10,2),
  weight_unit VARCHAR(10),

  -- Visibility
  is_hidden BOOLEAN DEFAULT false,  -- retailer has hidden this from the app
  hidden_at TIMESTAMPTZ,
  hidden_by UUID,  -- admin user who hid it

  -- Sync metadata
  pos_status VARCHAR(20),  -- 'active', 'draft', 'archived'
  pos_updated_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_hash VARCHAR(64),  -- SHA256 of product data, to detect changes without deep comparison

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, pos_product_id)
);

CREATE INDEX idx_pos_products_tenant ON pos_products(tenant_id);
CREATE INDEX idx_pos_products_hidden ON pos_products(tenant_id, is_hidden);
CREATE INDEX idx_pos_products_type ON pos_products(tenant_id, product_type);
CREATE INDEX idx_pos_products_sku ON pos_products(tenant_id, sku);
```

### 2.5 Product Sync Service

```typescript
// services/sync/product-sync.service.ts
```

The sync service runs on a configurable interval per tenant (default: every 30 minutes). It can also be triggered manually from the admin dashboard.

**Sync flow:**
1. Get tenant's POS adapter (Shopify or Lightspeed based on `tenants.pos_type`)
2. Fetch products updated since `tenants.last_product_sync_at` (incremental sync)
3. For each product:
   a. Compute SHA256 hash of normalized product data
   b. Check if product exists in `pos_products` by `tenant_id` + `pos_product_id`
   c. If exists and hash matches → skip (no changes)
   d. If exists and hash differs → update record
   e. If doesn't exist → insert new record
4. Update `tenants.last_product_sync_at`
5. Log sync results (products added, updated, unchanged)

**Full sync vs incremental:**
- First sync for a new tenant: fetch ALL products (full sync)
- Subsequent syncs: fetch only products updated since last sync (incremental)
- Admin dashboard has a "Force Full Sync" button that resets `last_product_sync_at` to null

**Sync scheduler:**
- Use `node-cron` or `setInterval` to run sync for each active tenant
- Stagger syncs so not all tenants sync at the same time
- Each tenant has a `product_sync_interval_minutes` setting (default: 30)
- Skip sync if tenant status is not 'active'

**Error handling:**
- If POS API returns rate limit error → retry with exponential backoff
- If POS API is down → log error, skip this sync cycle, try again next cycle
- If a single product fails to sync → log error, continue with remaining products
- Send email notification to TimpCreative super admin if a tenant's sync fails 3 times consecutively

---

## Part 3: Product-UHTD Mapping

### 3.1 Mapping Table

#### Table: `product_uhtd_mappings`
```sql
CREATE TABLE product_uhtd_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pos_product_id UUID NOT NULL REFERENCES pos_products(id) ON DELETE CASCADE,
  uhtd_compatible_part_id UUID NOT NULL REFERENCES uhtd_compatible_parts(id) ON DELETE CASCADE,

  -- Mapping metadata
  confidence_score DECIMAL(3,2),  -- 0.00 to 1.00, from fuzzy match
  is_confirmed BOOLEAN DEFAULT false,  -- human has verified this mapping
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,

  -- Auto-match details
  match_method VARCHAR(20),  -- 'fuzzy_auto' | 'manual' | 'sku_match'
  match_details JSONB,  -- store the fuzzy match score breakdown

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, pos_product_id, uhtd_compatible_part_id)
);

CREATE INDEX idx_mappings_tenant ON product_uhtd_mappings(tenant_id);
CREATE INDEX idx_mappings_product ON product_uhtd_mappings(pos_product_id);
CREATE INDEX idx_mappings_confirmed ON product_uhtd_mappings(tenant_id, is_confirmed);
```

### 3.2 Fuzzy Matching Service

```typescript
// services/mapping/fuzzy-matcher.service.ts
```

When a new product syncs from the POS, automatically attempt to match it to UHTD entries using Fuse.js:

**Matching strategy:**
1. Load all `uhtd_compatible_parts` entries
2. For each unmatched `pos_product`, run Fuse.js search with these weighted keys:
   - `generic_part_name` (weight: 2.0) — most important
   - `generic_part_number` (weight: 3.0) — exact match on part number is strongest signal
   - `manufacturer` (weight: 1.0)
3. Fuse.js config: `threshold: 0.4`, `includeScore: true`, `ignoreLocation: true`
4. If best match score < 0.3 (very strong match), auto-create a mapping with `confidence_score` and `match_method: 'fuzzy_auto'`, `is_confirmed: false`
5. If best match score is between 0.3 and 0.6, create a "suggested" mapping that appears in the admin mapping tool for human review
6. If best match score > 0.6, no auto-mapping — product appears as "unmapped" in admin

**SKU-based matching:**
Before fuzzy matching, attempt direct SKU match:
- If `pos_product.sku` exactly matches a `uhtd_compatible_parts.generic_part_number`, create a high-confidence mapping immediately
- This catches cases where the retailer uses manufacturer part numbers as SKUs

### 3.3 Mapping Tool (Retailer Admin Dashboard)

Build a page at `/admin/products` in the dashboard that shows:

**Product list view:**
- Table of all synced products from the retailer's POS
- Columns: Image thumbnail, Product Name, SKU, Price, Inventory Qty, Mapping Status, Visibility
- Mapping Status badges:
  - 🟢 "Mapped" — confirmed mapping exists
  - 🟡 "Suggested" — auto-match found, needs confirmation
  - 🔴 "Unmapped" — no match found
  - ⚫ "Hidden" — product is hidden from the app
- Filter by: mapping status, product type/category, search by name/SKU
- Bulk actions: hide selected, confirm suggested mappings

**Mapping modal (when clicking a product):**
- Shows the product details (name, SKU, image, description)
- If suggested mapping exists: shows the UHTD part it was matched to, with confidence score. "Confirm" or "Reject" buttons.
- Search field to manually search UHTD parts by name or part number
- Dropdown to select which spa models this product is compatible with (multi-select)
- "Create New UHTD Entry" link (opens in super admin) for products that don't exist in UHTD yet
- Save button creates/updates the mapping with `is_confirmed: true`, `match_method: 'manual'`

**Product visibility toggle:**
- Click to hide/show a product from the customer app
- Hidden products persist across syncs (the `is_hidden` flag is on our side, not the POS)
- Useful for excluding non-spa products (TAB sells billiards equipment)

### 3.4 Admin API Endpoints

```
GET /api/v1/admin/products
  Query params: page, pageSize, status (mapped|suggested|unmapped|hidden), search, productType
  → Returns: paginated product list with mapping status

PUT /api/v1/admin/products/:id/visibility
  Body: { isHidden: boolean }
  → Toggles product visibility

GET /api/v1/admin/products/:id/mapping-suggestions
  → Returns: top 5 UHTD fuzzy match suggestions for this product

POST /api/v1/admin/product-mappings
  Body: { posProductId, uhtdCompatiblePartId, isConfirmed: true }
  → Creates or updates a mapping

DELETE /api/v1/admin/product-mappings/:id
  → Removes a mapping

POST /api/v1/admin/products/sync
  → Triggers an immediate full product sync for this tenant

GET /api/v1/admin/products/sync-status
  → Returns: last sync time, products added/updated/unchanged in last sync, next scheduled sync
```

---

## Part 4: Super Admin UHTD Management

### 4.1 UHTD Management Interface

Build pages at `/super-admin/uhtd` in the dashboard:

**Brands page:**
- List all brands with model count
- Add/edit/deactivate brands

**Model Lines page (within a brand):**
- List all model lines for selected brand
- Add/edit model lines

**Models page (within a model line):**
- List all models with year ranges, specs
- Add/edit models with full spec entry form:
  - Name, year_start, year_end, water_capacity, jet_count, seating_capacity
  - Dimensions (L×W×H), weights (dry, filled)
  - Electrical requirement, has_ozone, has_uv
  - Image upload, spec sheet URL
  - Is Discontinued checkbox

**Compatible Parts page (within a model):**
- List all compatible parts for selected model grouped by category
- Add compatible part:
  - Select part category (from `uhtd_part_categories`)
  - Enter generic part number, part name, manufacturer
  - Is OEM checkbox
  - Compatible sanitization systems (multi-select, only for chemicals)
  - Notes field
- Copy parts from another model (for models in the same line that share parts)
- Bulk import from CSV

### 4.2 Super Admin API Endpoints

```
# Brands
GET    /api/v1/super-admin/uhtd/brands
POST   /api/v1/super-admin/uhtd/brands
PUT    /api/v1/super-admin/uhtd/brands/:id
DELETE /api/v1/super-admin/uhtd/brands/:id

# Model Lines
GET    /api/v1/super-admin/uhtd/brands/:brandId/model-lines
POST   /api/v1/super-admin/uhtd/model-lines
PUT    /api/v1/super-admin/uhtd/model-lines/:id
DELETE /api/v1/super-admin/uhtd/model-lines/:id

# Models
GET    /api/v1/super-admin/uhtd/model-lines/:modelLineId/models
POST   /api/v1/super-admin/uhtd/models
PUT    /api/v1/super-admin/uhtd/models/:id
DELETE /api/v1/super-admin/uhtd/models/:id

# Compatible Parts
GET    /api/v1/super-admin/uhtd/models/:modelId/compatible-parts
POST   /api/v1/super-admin/uhtd/compatible-parts
PUT    /api/v1/super-admin/uhtd/compatible-parts/:id
DELETE /api/v1/super-admin/uhtd/compatible-parts/:id
POST   /api/v1/super-admin/uhtd/compatible-parts/bulk-import  # CSV upload
POST   /api/v1/super-admin/uhtd/models/:modelId/copy-parts-from/:sourceModelId

# Part Categories
GET    /api/v1/super-admin/uhtd/part-categories
POST   /api/v1/super-admin/uhtd/part-categories

# Stats
GET    /api/v1/super-admin/uhtd/stats
  → Returns: { totalBrands, totalModels, totalParts, brandsWithNoParts, modelsWithNoParts }
```

---

## Part 5: Product Query Service (for Mobile App)

### 5.1 How Products Are Served to Customers

When a customer opens the shop in the app, they should only see products that are:
1. Synced from their retailer's POS (`tenant_id` match)
2. Not hidden (`is_hidden = false`)
3. Compatible with their registered spa (matched via UHTD mapping)
4. Compatible with their sanitization system (for chemicals)
5. In stock (`inventory_quantity > 0`), or optionally show out-of-stock items grayed out

### 5.2 Product API Endpoints

```
GET /api/v1/products
  Query params: page, pageSize, category, search, spaProfileId, inStockOnly
  → If spaProfileId provided: filters to compatible products only
  → If no spaProfileId: returns all non-hidden products (less useful, but needed for browsing)

GET /api/v1/products/:id
  → Full product details including variants, images, compatibility info

GET /api/v1/products/compatible/:spaProfileId
  → Returns all products compatible with this spa, grouped by part category
  → This is the primary endpoint for the "Shop" tab

GET /api/v1/products/categories
  → Returns available product categories for this tenant (derived from synced product types and UHTD part categories)
```

### 5.3 Compatibility Query Logic

```sql
-- Get compatible products for a spa profile
SELECT pp.*
FROM pos_products pp
INNER JOIN product_uhtd_mappings pum ON pp.id = pum.pos_product_id
INNER JOIN uhtd_compatible_parts ucp ON pum.uhtd_compatible_part_id = ucp.id
WHERE pp.tenant_id = $tenantId
  AND pp.is_hidden = false
  AND pum.is_confirmed = true
  AND ucp.spa_model_id = $uhtdSpaModelId  -- from the user's spa profile
  AND (
    ucp.compatible_sanitization_systems IS NULL  -- universal (not chemical-specific)
    OR $userSanitizationSystem = ANY(ucp.compatible_sanitization_systems)
  )
ORDER BY ucp.part_category_id, pp.title;
```

Products that aren't mapped to the UHTD can still appear in a "General Products" or "Browse All" section, but they won't appear in the personalized "Recommended for Your Spa" feed.

---

## Verification Checklist

Before moving to Phase 2, verify:

- [ ] UHTD tables exist and are populated with at least one brand's full model lineup
- [ ] UHTD API endpoints return correct cascading data (brands → model lines → models → years)
- [ ] TAB's POS is connected and product sync runs successfully
- [ ] Products from TAB appear in the `pos_products` table
- [ ] Fuzzy matching suggests reasonable UHTD mappings for synced products
- [ ] Admin dashboard shows product list with mapping status indicators
- [ ] Admin can confirm/reject suggested mappings
- [ ] Admin can manually search and create mappings
- [ ] Admin can hide/show products
- [ ] Admin can trigger manual sync and see sync status
- [ ] Super admin can add/edit brands, model lines, models, and compatible parts
- [ ] Product API returns filtered results based on spa profile and sanitization system
- [ ] Sync runs on schedule without manual intervention
- [ ] Sync handles POS rate limits gracefully
