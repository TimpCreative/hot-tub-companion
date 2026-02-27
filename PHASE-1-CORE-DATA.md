# Phase 1 — Core Data Layer

**Depends on:** Phase 0 (backend running, database schema, auth working)
**Unlocks:** Phase 2 (customer app needs products and UHTD data)

---

## Manual Steps Required (Do These First)

1. **Confirm TAB's POS system.** Contact Take A Break and determine whether they use Lightspeed R-Series, Lightspeed X-Series, or Shopify. Get the exact product name. This determines which API integration to build first.

2. **Get POS API credentials:**
   - **If Shopify:** Go to TAB's Shopify admin → Settings → Apps → Develop Apps → Create App → Configure Storefront API scopes (read products, read product listings, read inventory) AND Admin API scopes (read products, read inventory, read orders, write orders). Install the app and copy both tokens.
   - **If Lightspeed X-Series:** Register at https://x-series-api.lightspeedhq.com/, create an app (Add-on type for multi-retailer use), get client_id and client_secret. Have TAB authorize your app via OAuth flow.

3. **Begin UHTD data collection (parallel track).** Start a spreadsheet with the following columns for each spa model TAB sells:
   - Brand, Model Line, Model Name, **Individual Year** (one row per year), Water Capacity (gallons), Filter Type/Part Number, Number of Jets, Seating Capacity, Dimensions, Is Discontinued (Y/N), Data Source
   - Initial brands: Jacuzzi, Sundance, Hydropool, Endless Pools, Cal Spas, DreamMaker
   - Source this from manufacturer spec sheets, TAB's knowledge, and manufacturer websites
   - **Important:** Every year gets its own row. J-335 2019, J-335 2020, J-335 2021 = 3 rows.

4. **Get a sample of TAB's product catalog.** Ask TAB to export their product list (CSV or screenshot). Note:
   - Product names and how they format them
   - SKU formats
   - UPC/Barcode availability
   - How variants are structured (sizes, colors)
   - Categories they use

---

## What Phase 1 Builds

At the end of this phase, you will have:

- **UHTD database architecture** with three logical databases (SCdb, PCdb, Qdb)
- **Compatibility Groups (Comps)** system for efficient part-to-spa mapping
- **Individual year strategy** — every spa model-year gets its own row
- **Pending/confirmed workflow** for data quality control
- Initial spa model data for 6 brands (Jacuzzi, Sundance, Hydropool, Endless Pools, Cal Spas, DreamMaker)
- POS integration that syncs TAB's product catalog (one row per variant)
- Auto-mapping algorithm using UPC, SKU, and name matching
- Product sync service running on configurable intervals
- Super admin UHTD management interface with Comp-aware data entry
- Audit logging for all UHTD changes
- Product visibility controls (hide/show products from app)
- Tenant correction request system

---

## Architecture Reference

> **The complete UHTD architecture specification is in `UHTD-Architecture-Overview-v2.1.md`.** This Phase 1 document provides implementation guidance. For detailed rationale, edge cases, and design decisions, consult the v2.1 document.

---

## UHTD Architecture Summary

The UHTD (Universal Hot Tub Database) is modeled after the automotive aftermarket industry's ACES/PIES standards. It consists of three logical databases:

| Database | Full Name | Purpose |
|----------|-----------|---------|
| **SCdb** | Spa Configuration Database | All spas, hot tubs, swim spas — the "equipment" |
| **PCdb** | Parts Catalog Database | All parts, components, accessories |
| **Qdb** | Qualifier Database | Additional attributes: sanitization system, voltage, ozone, etc. |

### Key Design Decisions (Locked In)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Year storage | Individual rows | Each year = own record. Can't split ranges later. |
| Part deduplication | None | Every manufacturer variant = own row. Pleatco, Unicel, Filbur = 3 rows. |
| Source of truth | `part_spa_compatibility` | All compatibility derives from this table. |
| Comp IDs | Human-readable VARCHAR(50) | `COMP-JAC-FILT-001` for bulk import UX. |
| Bulk import status | `pending` first | Requires super admin review before going live. |

### How It Fits the Platform

1. Customer selects their spa in the mobile app (Brand → Year → Model)
2. System looks up compatible parts via `part_spa_compatibility`
3. Filters to only products the retailer sells (POS sync + UHTD mapping)
4. Applies qualifier filtering (sanitization system, voltage)
5. Displays retailer's products with retailer's pricing

**The UHTD contains no pricing.** All prices come from the tenant's POS system.

---

## Part 1: SCdb — Spa Configuration Database

The SCdb organizes spas in a three-level hierarchy: **Brand → Model Line → Model-Year Record**.

### Individual Year Strategy (Critical)

Every model-year gets its own database row. A J-335 sold from 2019-2024 creates **6 rows**:

| id | name | year |
|----|------|------|
| uuid-1 | J-335 | 2019 |
| uuid-2 | J-335 | 2020 |
| uuid-3 | J-335 | 2021 |
| uuid-4 | J-335 | 2022 |
| uuid-5 | J-335 | 2023 |
| uuid-6 | J-335 | 2024 |

**Why this is intentional:**
- Never have to split year ranges when mid-year revisions surface
- Customers find their exact year without ambiguity ("I have a 2021 J-335")
- Part compatibility mapped at year level — change any single year without range surgery
- Simple data model — no range logic in queries

### 1.1 Migration: SCdb Tables

#### Table: `scdb_brands`
```sql
CREATE TABLE scdb_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  logo_url TEXT,
  website_url TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,  -- soft delete
  data_source VARCHAR(100),  -- 'manual', 'manufacturer_website', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scdb_brands_name ON scdb_brands(name);
CREATE INDEX idx_scdb_brands_active ON scdb_brands(is_active) WHERE deleted_at IS NULL;
```

#### Table: `scdb_model_lines`
```sql
CREATE TABLE scdb_model_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES scdb_brands(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  data_source VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(brand_id, name)
);

CREATE INDEX idx_scdb_model_lines_brand ON scdb_model_lines(brand_id);
```

#### Table: `scdb_spa_models`
```sql
CREATE TABLE scdb_spa_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_line_id UUID NOT NULL REFERENCES scdb_model_lines(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES scdb_brands(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  year INTEGER NOT NULL,  -- individual year (2019, 2020, 2021, etc.)
  manufacturer_sku VARCHAR(100),  -- for POS mapping
  
  -- Specifications
  water_capacity_gallons INTEGER,
  jet_count INTEGER,
  seating_capacity INTEGER,
  dimensions_length_inches INTEGER,
  dimensions_width_inches INTEGER,
  dimensions_height_inches INTEGER,
  weight_dry_lbs INTEGER,
  weight_filled_lbs INTEGER,
  electrical_requirement VARCHAR(50),
  
  -- Features
  has_ozone BOOLEAN DEFAULT false,
  has_uv BOOLEAN DEFAULT false,
  has_salt_system BOOLEAN DEFAULT false,
  
  -- Media
  image_url TEXT,
  spec_sheet_url TEXT,
  
  -- Status
  is_discontinued BOOLEAN DEFAULT false,
  notes TEXT,
  data_source VARCHAR(100),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(model_line_id, name, year)
);

CREATE INDEX idx_scdb_models_model_line ON scdb_spa_models(model_line_id);
CREATE INDEX idx_scdb_models_brand ON scdb_spa_models(brand_id);
CREATE INDEX idx_scdb_models_name ON scdb_spa_models(name);
CREATE INDEX idx_scdb_models_year ON scdb_spa_models(year);
CREATE INDEX idx_scdb_models_active ON scdb_spa_models(brand_id, year) WHERE deleted_at IS NULL;
```

### 1.2 Tenant Brand Visibility

Retailers can restrict which brands appear during customer spa registration:

```sql
CREATE TABLE tenant_brand_visibility (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES scdb_brands(id) ON DELETE CASCADE,
  is_visible BOOLEAN DEFAULT true,
  
  PRIMARY KEY (tenant_id, brand_id)
);
```

**Default behavior:** All brands visible. Override per tenant as needed.

### 1.3 SCdb Public API Endpoints

These require only tenant API key (no user auth) because the mobile app needs them during spa registration:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/scdb/brands` | List active brands (filtered by tenant visibility) |
| GET | `/api/v1/scdb/brands/:brandId/model-lines` | Model lines for a brand |
| GET | `/api/v1/scdb/model-lines/:id/models` | Distinct model names in a model line |
| GET | `/api/v1/scdb/models/:modelName/years` | Available years for a model name |
| GET | `/api/v1/scdb/models/:id` | Full model-year details and specifications |

**Consumer Flow:** Brand → Year → Model (UI presents it this way)

---

## Part 2: PCdb — Parts Catalog Database

The PCdb catalogs every part that can be associated with a spa. **Every manufacturer's version of a part gets its own entry** — if Pleatco, Unicel, and Filbur all make the same filter, that's 3 rows in `pcdb_parts`.

### 2.1 Part Categories

```sql
CREATE TABLE pcdb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_name VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pcdb_categories (name, display_name, sort_order) VALUES
  ('filter', 'Filters', 1),
  ('cover', 'Covers', 2),
  ('chemical', 'Chemicals', 3),
  ('pump', 'Pumps', 4),
  ('jet', 'Jets', 5),
  ('heater', 'Heaters', 6),
  ('control_panel', 'Control Panels', 7),
  ('pillow', 'Pillows & Headrests', 8),
  ('cover_lifter', 'Cover Lifters', 9),
  ('steps', 'Steps & Accessories', 10),
  ('ozonator', 'Ozonators', 11),
  ('circulation_pump', 'Circulation Pumps', 12),
  ('blower', 'Blowers', 13),
  ('light', 'Lights', 14),
  ('plumbing', 'Plumbing & Fittings', 15);
```

### 2.2 Interchange Groups

Parts that are cross-brand equivalents share an interchange group. This is a reference, not deduplication — each part keeps its own row.

```sql
CREATE TABLE pcdb_interchange_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 Parts Table

```sql
CREATE TABLE pcdb_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES pcdb_categories(id) ON DELETE RESTRICT,
  
  -- Identification (for POS auto-mapping)
  part_number VARCHAR(100),
  upc VARCHAR(20),  -- Universal Product Code (barcode) — primary mapping signal
  ean VARCHAR(20),  -- European Article Number (international barcode)
  sku_aliases TEXT[],  -- Alternate SKU formats: ['6000383A', 'J-6000-383A']
  name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(100),
  
  -- Classification
  interchange_group_id UUID REFERENCES pcdb_interchange_groups(id),
  is_oem BOOLEAN DEFAULT false,
  is_universal BOOLEAN DEFAULT false,  -- fits all spas, skip compatibility check
  is_discontinued BOOLEAN DEFAULT false,
  discontinued_at TIMESTAMPTZ,
  display_importance INTEGER DEFAULT 2,  -- 1=OEM/premium, 2=standard, 3=third-party
  
  -- Physical attributes
  dimensions_json JSONB,
  
  -- Media
  image_url TEXT,
  spec_sheet_url TEXT,
  
  -- Metadata
  notes TEXT,
  data_source VARCHAR(100),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable trigram extension for typo-tolerant search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_pcdb_parts_category ON pcdb_parts(category_id);
CREATE INDEX idx_pcdb_parts_number ON pcdb_parts(part_number);
CREATE INDEX idx_pcdb_parts_upc ON pcdb_parts(upc) WHERE upc IS NOT NULL;
CREATE INDEX idx_pcdb_parts_ean ON pcdb_parts(ean) WHERE ean IS NOT NULL;
CREATE INDEX idx_pcdb_parts_manufacturer ON pcdb_parts(manufacturer);
CREATE INDEX idx_pcdb_parts_interchange ON pcdb_parts(interchange_group_id) WHERE interchange_group_id IS NOT NULL;
CREATE INDEX idx_pcdb_parts_name ON pcdb_parts USING gin(to_tsvector('english', name));
CREATE INDEX idx_pcdb_parts_name_trgm ON pcdb_parts USING gin(name gin_trgm_ops);
CREATE INDEX idx_pcdb_parts_number_trgm ON pcdb_parts USING gin(part_number gin_trgm_ops) WHERE part_number IS NOT NULL;
CREATE INDEX idx_pcdb_parts_sku_aliases ON pcdb_parts USING gin(sku_aliases) WHERE sku_aliases IS NOT NULL;
CREATE INDEX idx_pcdb_parts_active ON pcdb_parts(category_id) WHERE deleted_at IS NULL;
```

### 2.4 Auto-Mapping Priority

When syncing POS products, attempt automatic UHTD mapping using these signals (priority order):

| Signal | Weight | Method |
|--------|--------|--------|
| UPC/EAN exact match | 0.60 | `pos_products.barcode` = `pcdb_parts.upc` or `ean` |
| SKU/part number exact | 0.50 | `pos_products.sku` = `pcdb_parts.part_number` |
| SKU alias match | 0.40 | `pos_products.sku` IN `pcdb_parts.sku_aliases` |
| SKU partial match | 0.25 | Normalized substring (strip hyphens, spaces, lowercase) |
| Name similarity | 0.25 | Trigram similarity or Levenshtein distance |
| Manufacturer/vendor | 0.15 | `pos_products.vendor` = `pcdb_parts.manufacturer` |

**Score ≥ 0.80:** Set `mapping_status='auto_suggested'`, surface for one-click confirm  
**Score < 0.80:** Set `mapping_status='unmapped'`, require manual mapping

### 2.5 Universal Parts

Parts marked `is_universal=true` (e.g., pH test strips, generic spa cleaner) fit every spa. The query layer short-circuits — if `is_universal=true`, it passes compatibility for any spa automatically. **Universal parts are never added to `part_spa_compatibility` and never included in Comp calculations.**

### 2.6 Discontinued Part Handling

When a UHTD part is marked discontinued:
- POS products mapped to it retain mapping but get `discontinued_uhtd_part` flag
- Retailer admins see a warning suggesting they remap or verify
- Part remains in its interchange group (customers can find alternatives)
- Customer-facing listings hide products mapped to discontinued parts unless still in stock

---

## Part 3: Source of Truth — `part_spa_compatibility`

**This is the most important table in the system.** Every compatibility relationship traces back here.

### 3.1 Table Schema

```sql
CREATE TABLE part_spa_compatibility (
  part_id UUID NOT NULL REFERENCES pcdb_parts(id) ON DELETE CASCADE,
  spa_model_id UUID NOT NULL REFERENCES scdb_spa_models(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'confirmed', 'rejected'
  
  -- Compatibility details
  fit_notes TEXT,  -- 'requires adapter bracket', 'only 2-inch plumbing'
  quantity_required INTEGER DEFAULT 1,  -- how many the spa needs
  position VARCHAR(100),  -- 'primary pump', 'top filter', etc.
  
  -- Provenance
  source VARCHAR(50),  -- 'manual', 'comp_assignment', 'bulk_import', 'auto_detected'
  added_by UUID,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  
  PRIMARY KEY (part_id, spa_model_id)
);

CREATE INDEX idx_part_spa_compat_part ON part_spa_compatibility(part_id);
CREATE INDEX idx_part_spa_compat_spa ON part_spa_compatibility(spa_model_id);
CREATE INDEX idx_part_spa_compat_status ON part_spa_compatibility(status);
CREATE INDEX idx_part_spa_compat_confirmed ON part_spa_compatibility(part_id, spa_model_id) WHERE status = 'confirmed';
```

### 3.2 Pending/Confirmed Workflow

| Source | Default Status | Workflow |
|--------|----------------|----------|
| Manual entry by super admin | `confirmed` | Goes live immediately |
| Bulk import | `pending` | Enters review queue |
| Auto-detected | `pending` | Enters review queue |
| Comp assignment | `confirmed` | Inherits from Comp |

**All customer-facing queries must include `WHERE status = 'confirmed'`.**

### 3.3 Why fit_notes, quantity_required, position Matter

Pure yes/no compatibility isn't always sufficient:

| Field | Example | Customer Value |
|-------|---------|----------------|
| `fit_notes` | "requires adapter bracket for pre-2021" | Actionable purchase info |
| `quantity_required` | 2 | "This spa needs 2 of these filters" |
| `position` | "top filter" vs "bottom filter" | Correct installation |

---

## Part 4: Qdb — Qualifier Database

Qualifiers refine compatibility beyond "part fits spa." A chlorine chemical is physically compatible, but if the customer uses bromine, showing chlorine is unhelpful.

### 4.1 Tables

```sql
CREATE TABLE qdb_qualifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  data_type VARCHAR(20) NOT NULL,  -- 'enum', 'boolean', 'number', 'text'
  allowed_values JSONB,
  applies_to VARCHAR(20) NOT NULL,  -- 'spa', 'part', 'both'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO qdb_qualifiers (name, display_name, data_type, allowed_values, applies_to) VALUES
  ('sanitization_system', 'Sanitization System', 'enum', '["bromine", "chlorine", "frog_ease", "copper", "silver_mineral"]', 'both'),
  ('voltage_requirement', 'Voltage Requirement', 'enum', '["120V", "240V"]', 'both'),
  ('ozone_compatible', 'Ozone Compatible', 'boolean', NULL, 'part'),
  ('uv_compatible', 'UV Compatible', 'boolean', NULL, 'part'),
  ('salt_compatible', 'Salt System Compatible', 'boolean', NULL, 'part');

CREATE TABLE qdb_spa_qualifiers (
  spa_model_id UUID NOT NULL REFERENCES scdb_spa_models(id) ON DELETE CASCADE,
  qualifier_id UUID NOT NULL REFERENCES qdb_qualifiers(id) ON DELETE CASCADE,
  value JSONB NOT NULL,
  
  PRIMARY KEY (spa_model_id, qualifier_id)
);

CREATE INDEX idx_qdb_spa_qualifiers_spa ON qdb_spa_qualifiers(spa_model_id);

CREATE TABLE qdb_part_qualifiers (
  part_id UUID NOT NULL REFERENCES pcdb_parts(id) ON DELETE CASCADE,
  qualifier_id UUID NOT NULL REFERENCES qdb_qualifiers(id) ON DELETE CASCADE,
  value JSONB NOT NULL,
  is_required BOOLEAN DEFAULT false,  -- if true, REQUIRES spa to match
  
  PRIMARY KEY (part_id, qualifier_id)
);

CREATE INDEX idx_qdb_part_qualifiers_part ON qdb_part_qualifiers(part_id);
```

### 4.2 Qualifier Filtering Logic

- **No required qualifiers:** Part passes unconditionally
- **Required qualifier:** Customer's spa must have matching value
- **Multiple required qualifiers:** ANDed together

---

## Part 5: Compatibility Groups (Comps)

### 5.1 What Comps Solve

With individual year records, the mapping explosion is pronounced. If 50 Jacuzzi model-years use the same filter, and there are 4 equivalent filters, that's 200 rows in `part_spa_compatibility`. Comps make this manageable.

### 5.2 Core Principles

1. A Comp is defined by its set of spas (stored in `comp_spas`)
2. A part appears in a Comp if it's compatible with **ALL** spas in that Comp (computed from `part_spa_compatibility`)
3. **Comps do not store parts.** There is no `comp_parts` table. Part membership is always computed dynamically.
4. Comps auto-generate when 2+ parts in the same category share 2+ identical spas
5. Comps can be manually created for edge cases
6. After creation, Comps are category-agnostic — parts from any category can match
7. Subset Comps are valid. A 12-spa Comp can coexist with a 47-spa Comp even if the 12 are a subset.

### 5.3 Tables

```sql
CREATE TABLE compatibility_groups (
  id VARCHAR(50) PRIMARY KEY,  -- COMP-JAC-FILT-001 (human-readable)
  name VARCHAR(255),
  description TEXT,
  auto_generated BOOLEAN DEFAULT false,
  source_category_id UUID REFERENCES pcdb_categories(id),
  created_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comps_auto ON compatibility_groups(auto_generated);
CREATE INDEX idx_comps_active ON compatibility_groups(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comps_name_trgm ON compatibility_groups USING gin(name gin_trgm_ops) WHERE name IS NOT NULL;

CREATE TABLE comp_spas (
  comp_id VARCHAR(50) NOT NULL REFERENCES compatibility_groups(id) ON DELETE CASCADE,
  spa_model_id UUID NOT NULL REFERENCES scdb_spa_models(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (comp_id, spa_model_id)
);

CREATE INDEX idx_comp_spas_comp ON comp_spas(comp_id);
CREATE INDEX idx_comp_spas_spa ON comp_spas(spa_model_id);
```

### 5.4 Comp ID Naming Convention

```
COMP-{BRAND_CODE}-{CATEGORY_CODE}-{SEQUENCE}

Examples:
  COMP-JAC-FILT-001   (Jacuzzi filters)
  COMP-SUND-PUMP-003  (Sundance pumps)
  COMP-MULTI-COV-012  (Multiple brands, covers)
  COMP-CUSTOM-001     (Manually created)
```

### 5.5 Comp Auto-Generation Rules

```typescript
async function checkAndCreateComps(partId: string, categoryId: string) {
  const partSpas = await getPartSpas(partId);
  if (partSpas.length < 2) return;  // Need at least 2 spas
  
  const matchingParts = await findPartsWithIdenticalSpas(categoryId, partSpas);
  if (matchingParts.length < 2) return;  // Need at least 2 parts
  
  const existingComp = await findCompByExactSpaSet(partSpas);
  if (existingComp) return;  // Already exists
  
  // Subset/superset Comps are allowed — no deduplication needed
  const compId = generateCompId(partSpas, categoryId);
  await createComp(compId, partSpas, categoryId, { autoGenerated: true });
}
```

### 5.6 Querying Parts in a Comp

```sql
SELECT p.*
FROM pcdb_parts p
JOIN part_spa_compatibility psc ON p.id = psc.part_id
JOIN comp_spas cs ON psc.spa_model_id = cs.spa_model_id
WHERE cs.comp_id = 'COMP-JAC-FILT-001'
  AND psc.status = 'confirmed'
  AND p.deleted_at IS NULL
GROUP BY p.id
HAVING COUNT(DISTINCT psc.spa_model_id) = (
  SELECT COUNT(*) FROM comp_spas WHERE comp_id = 'COMP-JAC-FILT-001'
);
```

### 5.7 Near-Match Comp Suggestions

Show Comps with ≥80% overlap when adding/editing a part:

```sql
WITH part_spas AS (
  SELECT spa_model_id FROM part_spa_compatibility WHERE part_id = $partId
),
comp_overlap AS (
  SELECT 
    cs.comp_id,
    COUNT(*) AS matching_spas,
    (SELECT COUNT(*) FROM comp_spas WHERE comp_id = cs.comp_id) AS total_comp_spas
  FROM comp_spas cs
  WHERE cs.spa_model_id IN (SELECT spa_model_id FROM part_spas)
  GROUP BY cs.comp_id
)
SELECT 
  cg.*,
  co.matching_spas,
  co.total_comp_spas,
  ROUND(co.matching_spas::decimal / co.total_comp_spas * 100, 1) AS match_percentage
FROM comp_overlap co
JOIN compatibility_groups cg ON co.comp_id = cg.id
WHERE co.matching_spas::decimal / co.total_comp_spas >= 0.8
  AND cg.deleted_at IS NULL
ORDER BY match_percentage DESC;
```

### 5.8 Comp Edit Cascading

When spas are added to or removed from a Comp:

- **Adding spa:** For every part currently in the Comp (computed), add row to `part_spa_compatibility` with `source='comp_assignment'`
- **Removing spa:** For parts that ONLY have compatibility via this Comp (`source='comp_assignment'` and no other path), remove the row. Parts with manual compatibility retain it.

---

## Part 6: POS Integration Service

### 6.1 POS Adapter Interface

```typescript
interface POSAdapter {
  testConnection(): Promise<boolean>;
  refreshToken(): Promise<void>;
  fetchAllProducts(): Promise<NormalizedProduct[]>;
  fetchProductById(posProductId: string): Promise<NormalizedProduct>;
  fetchProductsSince(lastSyncAt: Date): Promise<NormalizedProduct[]>;
  getInventoryLevel(posProductId: string, variantId?: string): Promise<number>;
  fetchRecentOrders(limit: number): Promise<NormalizedOrder[]>;
}
```

### 6.2 Product Sync Table

**Important:** Each variant is its own row so it can be independently mapped.

```sql
CREATE TABLE pos_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pos_product_id VARCHAR(255) NOT NULL,
  pos_variant_id VARCHAR(255),  -- each variant = separate row
  
  -- Product data from POS
  title VARCHAR(500) NOT NULL,
  description TEXT,
  vendor VARCHAR(255),
  product_type VARCHAR(255),
  tags TEXT[],
  price INTEGER NOT NULL,  -- cents (no UHTD pricing!)
  compare_at_price INTEGER,
  sku VARCHAR(255),
  barcode VARCHAR(50),  -- UPC for auto-mapping
  images JSONB DEFAULT '[]',
  variants JSONB DEFAULT '[]',
  inventory_quantity INTEGER DEFAULT 0,
  weight DECIMAL(10,2),
  weight_unit VARCHAR(10),
  
  -- Visibility
  is_hidden BOOLEAN DEFAULT false,
  hidden_at TIMESTAMPTZ,
  hidden_by UUID,
  
  -- UHTD Mapping
  uhtd_part_id UUID REFERENCES pcdb_parts(id),
  mapping_status VARCHAR(20) DEFAULT 'unmapped',  -- 'unmapped', 'auto_suggested', 'confirmed'
  mapping_confidence DECIMAL(3,2),
  mapped_by UUID,
  mapped_at TIMESTAMPTZ,
  
  -- Sync metadata
  pos_status VARCHAR(20),
  pos_updated_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_hash VARCHAR(64),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, pos_product_id, pos_variant_id)
);

CREATE INDEX idx_pos_products_tenant ON pos_products(tenant_id);
CREATE INDEX idx_pos_products_uhtd ON pos_products(uhtd_part_id);
CREATE INDEX idx_pos_products_mapping ON pos_products(tenant_id, mapping_status);
CREATE INDEX idx_pos_products_barcode ON pos_products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_pos_products_sku ON pos_products(sku) WHERE sku IS NOT NULL;
```

### 6.3 Variant Handling

POS products with multiple variants (e.g., chemical in 2lb, 5lb, 10lb sizes) become multiple `pos_products` rows:

| pos_product_id | pos_variant_id | title | sku | price |
|----------------|----------------|-------|-----|-------|
| prod_123 | var_a | Spa Shock 2lb | SHOCK-2LB | 1299 |
| prod_123 | var_b | Spa Shock 5lb | SHOCK-5LB | 2499 |
| prod_123 | var_c | Spa Shock 10lb | SHOCK-10LB | 3999 |

Each variant can map to a different UHTD part (or the same one).

---

## Part 7: Audit Trail & Data Provenance

### 7.1 Audit Log

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(255) NOT NULL,  -- UUID or VARCHAR for Comps
  action VARCHAR(20) NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_reason TEXT
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name, changed_at DESC);
CREATE INDEX idx_audit_log_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user ON audit_log(changed_by, changed_at DESC);
```

**Audited tables:** `scdb_spa_models`, `pcdb_parts`, `part_spa_compatibility`, `comp_spas`, `compatibility_groups`, `qdb_spa_qualifiers`, `qdb_part_qualifiers`

### 7.2 Data Source Tracking

| Source Value | Meaning |
|--------------|---------|
| `manual` | Super admin entered by hand |
| `manufacturer_spec_sheet` | From official spec document |
| `manufacturer_website` | From manufacturer's website |
| `retailer_knowledge` | Retailer provided via correction request |
| `bulk_import` | Entered via CSV bulk import |

### 7.3 Tenant Correction Requests

```sql
CREATE TABLE correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL,  -- 'missing_model', 'wrong_specs', 'wrong_compatibility', 'missing_part', 'other'
  description TEXT NOT NULL,
  source_reference TEXT,  -- optional URL or document reference
  affected_entity_type VARCHAR(50),  -- 'brand', 'model', 'part', 'comp'
  affected_entity_id VARCHAR(255),
  
  -- Resolution
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'in_review', 'resolved', 'rejected'
  resolution_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_correction_requests_tenant ON correction_requests(tenant_id);
CREATE INDEX idx_correction_requests_status ON correction_requests(status);
```

---

## Part 8: Super Admin UHTD Management Interface

### 8.1 Navigation Structure

```
/super-admin/uhtd
├── /brands              — List/manage brands
├── /brands/:id          — Brand detail (model lines within)
├── /model-lines/:id     — Model line detail (models within)
├── /models/:id          — Model detail (specs, Comps, compatible parts)
├── /parts               — List/manage all parts
├── /parts/new           — Add new part (Comp-aware)
├── /parts/:id           — Part detail (spa compatibility, interchange group)
├── /comps               — List all Comps
├── /comps/:id           — Comp detail (spas and computed parts)
├── /categories          — Manage part categories
├── /interchange-groups  — Manage interchange groups
├── /import              — Bulk import tools
├── /review-queue        — Pending compatibility records
├── /correction-requests — Tenant correction requests
└── /audit-log           — Change history
```

### 8.2 Adding a New Part (Key Workflow)

**Two-panel layout:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Add New Part                                                                   │
│                                                                                 │
│  Part Number: [6000-383      ]  Category: [Filter           ▼]                 │
│  UPC:         [012345678901  ]  Manufacturer: [Jacuzzi      ]                  │
│  Name:        [ProClear 6000-383A Filter                      ]                │
│  ☐ Is OEM  ☐ Is Universal  Data Source: [manufacturer_spec_sheet ▼]            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │  SELECT COMPATIBLE SPAS         │  │  COMPATIBILITY GROUPS (Comps)       │  │
│  │                                 │  │                                     │  │
│  │  🔍 [Search spas...        ]    │  │  Click to select all spas:         │  │
│  │  [☑ Show selected only]         │  │                                     │  │
│  │  ─────────────────────────────  │  │  ● COMP-JAC-FILT-001               │  │
│  │  ☑ Jacuzzi J-335 2019          │  │    47 spas • Exact match            │  │
│  │  ☑ Jacuzzi J-335 2020          │  │    [Quickview]                      │  │
│  │  ☑ Jacuzzi J-335 2021          │  │                                     │  │
│  │  ☑ Jacuzzi J-345 2019          │  │  ○ COMP-JAC-FILT-002               │  │
│  │  ☑ Jacuzzi J-345 2020          │  │    42 spas • 89% match              │  │
│  │  ... (42 more selected)         │  │    [Quickview]                      │  │
│  │                                 │  │                                     │  │
│  │  47 spas selected               │  │  [+ Create New Comp]                │  │
│  │                                 │  │                                     │  │
│  │  [+ Create New Comp from       │  │                                     │  │
│  │     Selected Spas]              │  │                                     │  │
│  └─────────────────────────────────┘  └─────────────────────────────────────┘  │
│                                                                                 │
│  [Cancel]                                              [Save Part]              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**UI Behaviors:**
1. Search is live/responsive — results filter as you type
2. Clicking a Comp selects all its spas in the left panel
3. "Show selected only" filters to just selected spas
4. "Quickview" opens popup showing Comp contents without navigating away
5. Near-matches show percentage overlap

### 8.3 Quickview Popup

```
┌────────────────────────────────────────────────────────┐
│  COMP-JAC-FILT-001                           [×]       │
│  J-300/J-400 ProClear Filter Group                     │
│  ──────────────────────────────────────────────────    │
│                                                        │
│  SPAS (47)                │  PARTS (4)                 │
│  ───────────              │  ──────────                │
│  • J-335 2019             │  • ProClear 6000-383A     │
│  • J-335 2020             │  • Pleatco 6CH-961        │
│  • J-335 2021             │  • Unicel C-6660          │
│  • J-345 2019             │  • Filbur FC-2715         │
│  • J-345 2020             │                           │
│  ... +42 more             │                           │
│                                                        │
│  [View Full Details]  [Select These Spas]              │
└────────────────────────────────────────────────────────┘
```

### 8.4 Bulk Import

CSV format with Comp IDs:

```csv
part_number,name,category,manufacturer,upc,is_oem,comp_ids,data_source
6000-383A,ProClear 6000-383A,filter,Jacuzzi,012345678901,true,COMP-JAC-FILT-001,manufacturer_spec_sheet
6CH-961,Pleatco 6CH-961,filter,Pleatco,012345678902,false,COMP-JAC-FILT-001,manual
PUMP-2HP,Waterway Executive 2HP,pump,Waterway,,false,"COMP-JAC-PUMP-001,COMP-SUND-PUMP-002",manual
```

**Import behavior:**
1. Look up Comp IDs, get all spas
2. Add to `part_spa_compatibility` with `status='pending'`
3. After import, check for new Comp auto-generation

---

## Part 9: API Endpoints

### 9.1 Super Admin SCdb Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/v1/super-admin/scdb/brands` | List or create brands |
| PUT/DELETE | `/api/v1/super-admin/scdb/brands/:id` | Update or soft-delete brand |
| GET/POST | `/api/v1/super-admin/scdb/model-lines` | List or create model lines |
| PUT/DELETE | `/api/v1/super-admin/scdb/model-lines/:id` | Update or soft-delete |
| GET/POST | `/api/v1/super-admin/scdb/models` | List or create model-year records |
| GET/PUT/DELETE | `/api/v1/super-admin/scdb/models/:id` | Get, update, or soft-delete |
| GET | `/api/v1/super-admin/scdb/models/:id/comps` | Comps this model-year belongs to |

### 9.2 Super Admin PCdb Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/v1/super-admin/pcdb/categories` | List or create categories |
| PUT | `/api/v1/super-admin/pcdb/categories/:id` | Update category |
| GET/POST | `/api/v1/super-admin/pcdb/parts` | List or create parts |
| GET/PUT/DELETE | `/api/v1/super-admin/pcdb/parts/:id` | Get, update, or soft-delete |
| GET | `/api/v1/super-admin/pcdb/parts/:id/spas` | Spas this part fits |
| POST | `/api/v1/super-admin/pcdb/parts/:id/spas` | Add spa compatibility |
| DELETE | `/api/v1/super-admin/pcdb/parts/:id/spas/:spaId` | Remove compatibility |
| POST | `/api/v1/super-admin/pcdb/parts/bulk-import` | CSV bulk import |
| GET/POST | `/api/v1/super-admin/pcdb/interchange-groups` | List or create interchange groups |
| GET | `/api/v1/super-admin/pcdb/interchange-groups/:id/parts` | Parts in group |

### 9.3 Super Admin Comp Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/v1/super-admin/comps` | List or manually create Comps |
| GET/PUT/DELETE | `/api/v1/super-admin/comps/:id` | Get, update, or soft-delete |
| GET | `/api/v1/super-admin/comps/:id/spas` | Spas in Comp |
| POST/DELETE | `/api/v1/super-admin/comps/:id/spas` | Add/remove spa (cascades) |
| GET | `/api/v1/super-admin/comps/:id/parts` | Computed parts (read-only) |
| GET | `/api/v1/super-admin/comps/near-matches` | Near-match Comps for spa IDs |

### 9.4 Super Admin Qdb Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT | `/api/v1/super-admin/qdb/qualifiers` | Manage qualifier definitions |
| GET/POST/DELETE | `/api/v1/super-admin/qdb/spas/:spaId/qualifiers` | Spa qualifier values |
| GET/POST/DELETE | `/api/v1/super-admin/qdb/parts/:partId/qualifiers` | Part qualifier requirements |

### 9.5 Super Admin Utility Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/super-admin/uhtd/stats` | Dashboard stats |
| GET | `/api/v1/super-admin/uhtd/search` | Unified search |
| GET | `/api/v1/super-admin/uhtd/review-queue` | Pending compatibility records |
| PUT | `/api/v1/super-admin/uhtd/review-queue/:id` | Approve/reject |
| GET | `/api/v1/super-admin/uhtd/correction-requests` | Tenant requests |
| PUT | `/api/v1/super-admin/uhtd/correction-requests/:id` | Resolve request |
| GET | `/api/v1/super-admin/uhtd/audit-log` | Filtered audit log |

### 9.6 Retailer Admin Product Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/products` | Synced products with mapping status |
| PUT | `/api/v1/admin/products/:id/visibility` | Hide/show product |
| GET | `/api/v1/admin/products/:id/uhtd-suggestions` | Top 5 UHTD matches |
| POST | `/api/v1/admin/products/:id/map` | Confirm UHTD mapping |
| DELETE | `/api/v1/admin/products/:id/map` | Remove mapping |
| POST | `/api/v1/admin/products/sync` | Trigger immediate sync |
| GET | `/api/v1/admin/products/sync-status` | Current sync status |
| POST | `/api/v1/admin/correction-requests` | Submit correction request |

### 9.7 Customer Product Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/products` | Product listing with filters |
| GET | `/api/v1/products/:id` | Full product details |
| GET | `/api/v1/products/compatible/:spaProfileId` | Compatible products (Shop tab) |
| GET | `/api/v1/products/categories` | Available categories for tenant |

---

## Part 10: Customer-Facing Compatibility Query

This powers the "Shop" tab — returns only products that are:
1. From the customer's retailer (`tenant_id`)
2. Not hidden (`is_hidden = false`)
3. Mapped to UHTD (`mapping_status = 'confirmed'`)
4. Compatible with customer's spa (via `part_spa_compatibility` with `status = 'confirmed'`)
5. Qualifiers match
6. Optionally in stock

```sql
SELECT
  pp.*,
  part.part_number,
  part.is_oem,
  part.display_importance,
  part.interchange_group_id,
  psc.quantity_required,
  psc.position,
  psc.fit_notes,
  cat.display_name AS category_name,
  cat.sort_order AS category_sort
FROM pos_products pp
JOIN pcdb_parts part ON pp.uhtd_part_id = part.id
JOIN pcdb_categories cat ON part.category_id = cat.id
LEFT JOIN part_spa_compatibility psc
  ON part.id = psc.part_id
  AND psc.spa_model_id = $spaModelId
  AND psc.status = 'confirmed'
LEFT JOIN qdb_part_qualifiers pq
  ON part.id = pq.part_id
  AND pq.is_required = true
LEFT JOIN qdb_spa_qualifiers sq
  ON sq.spa_model_id = $spaModelId
  AND sq.qualifier_id = pq.qualifier_id
WHERE pp.tenant_id = $tenantId
  AND pp.is_hidden = false
  AND pp.mapping_status = 'confirmed'
  AND part.deleted_at IS NULL
  AND (
    part.is_universal = true           -- universal parts skip compatibility
    OR psc.part_id IS NOT NULL         -- non-universal must have record
  )
  AND (
    pq.qualifier_id IS NULL            -- no qualifier requirement
    OR sq.value @> pq.value            -- qualifier matches
  )
ORDER BY cat.sort_order, part.display_importance, pp.title;
```

---

## Verification Checklist

Before moving to Phase 2, verify:

### SCdb (Spas)
- [ ] `scdb_brands`, `scdb_model_lines`, `scdb_spa_models` tables exist with correct columns
- [ ] Individual year strategy implemented (each year = own row)
- [ ] Soft delete (`deleted_at`) and `data_source` columns present
- [ ] At least one brand's full model lineup is populated (Jacuzzi recommended)
- [ ] SCdb API endpoints return correct cascading data
- [ ] Consumer flow works: Brand → Year → Model selection
- [ ] `tenant_brand_visibility` table exists

### PCdb (Parts)
- [ ] `pcdb_categories`, `pcdb_parts`, `pcdb_interchange_groups` tables exist
- [ ] Part categories are seeded
- [ ] Parts have `upc`, `ean`, `sku_aliases`, `display_importance` columns
- [ ] `is_discontinued` and `discontinued_at` columns present
- [ ] Interchange groups can be created and parts assigned
- [ ] Trigram indexes created for typo-tolerant search

### Source of Truth
- [ ] `part_spa_compatibility` has `status`, `fit_notes`, `quantity_required`, `position` columns
- [ ] Pending/confirmed workflow works
- [ ] Review queue shows pending records

### Comps
- [ ] `compatibility_groups` and `comp_spas` tables exist
- [ ] Comp IDs are human-readable VARCHAR(50)
- [ ] Comps can be manually created
- [ ] Comps auto-generate when conditions met (2+ parts, same category, 2+ spas)
- [ ] Comp quickview shows spas and computed parts
- [ ] Selecting a Comp selects all its spas
- [ ] Near-match suggestions work with percentage overlap
- [ ] Bulk import with Comp IDs creates `pending` records

### Qdb (Qualifiers)
- [ ] Qualifiers table seeded with sanitization_system, voltage, etc.
- [ ] Spas can have qualifiers assigned
- [ ] Parts can have qualifier requirements with `is_required` flag

### Audit & Provenance
- [ ] `audit_log` table exists with appropriate indexes
- [ ] UHTD changes are logged
- [ ] `correction_requests` table exists
- [ ] Tenants can submit correction requests

### POS Integration
- [ ] TAB's POS is connected
- [ ] Product sync runs successfully
- [ ] Each variant becomes its own `pos_products` row
- [ ] `barcode` column populated for UPC matching
- [ ] Auto-mapping algorithm runs with confidence scores
- [ ] Sync handles rate limits gracefully

### Retailer Admin
- [ ] Admin can view synced products with mapping status
- [ ] Admin can see auto-suggested mappings
- [ ] Admin can confirm or manually map products
- [ ] Admin can hide/show products
- [ ] Admin can trigger manual sync
- [ ] Admin can submit correction requests

### Customer Queries
- [ ] Product API returns filtered results based on spa profile
- [ ] `status='confirmed'` filter applied
- [ ] Sanitization system filtering works
- [ ] Universal parts bypass compatibility check
- [ ] Results ordered by category, display_importance, title

---

## Schema Migration Summary

If migrating from the original UHTD schema:

1. **Rename tables:**
   ```sql
   ALTER TABLE uhtd_brands RENAME TO scdb_brands;
   ALTER TABLE uhtd_model_lines RENAME TO scdb_model_lines;
   ALTER TABLE uhtd_spa_models RENAME TO scdb_spa_models;
   ALTER TABLE uhtd_part_categories RENAME TO pcdb_categories;
   ```

2. **Add new columns** to all tables (`data_source`, `deleted_at`, etc.)

3. **Convert year ranges to individual years:**
   - For each model with `year_start` and `year_end`, create individual rows for each year
   - Update all `part_spa_compatibility` references

4. **Create new tables:**
   - `pcdb_interchange_groups`
   - `part_spa_compatibility` (with new columns)
   - `audit_log`
   - `correction_requests`
   - `tenant_brand_visibility`

5. **Add indexes** including trigram indexes for search

---

*See `UHTD-Architecture-Overview-v2.1.md` for complete specification.*
