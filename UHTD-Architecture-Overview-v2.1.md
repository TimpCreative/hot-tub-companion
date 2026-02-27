# UHTD — Universal Hot Tub Database
## Architecture Overview & Technical Specification
### Version 2.1 • Hot Tub Companion Platform
### Prepared by TimpCreative — February 2026

---

# 1. Overview & Philosophy

The Universal Hot Tub Database (UHTD) is a centralized, multi-tenant reference database that catalogs every spa, hot tub, and swim spa model alongside every compatible part, accessory, and chemical. It is modeled after the automotive aftermarket industry's ACES/PIES standards, which solved the identical problem of mapping millions of parts to millions of vehicles decades ago.

The UHTD is not a storefront. It contains no pricing, no inventory levels, and no tenant-specific data. It is pure reference data — a canonical source of truth that answers one question: "What parts fit what spas?"

The UHTD is intentionally bloated. Every manufacturer's version of a part gets its own entry, even when cross-brand equivalents exist. Every individual model year gets its own row, even when nothing changed from the prior year. This is the price of universality — any tenant selling any product should be able to map it to a UHTD entry, and any customer with any spa from any year should find their exact configuration.

## 1.1 How It Fits the Platform

The Hot Tub Companion platform is white-labeled for spa retailers. Each retailer (tenant) connects their own POS/inventory system (Shopify, Lightspeed, etc.). The platform syncs their product catalog and maps those products to UHTD parts. When a customer opens their retailer's app, selects their hot tub model, and browses the shop, the system:

- Looks up the customer's spa model in the UHTD (SCdb)
- Finds all compatible parts for that spa in the UHTD (PCdb + part_spa_compatibility)
- Filters to only the parts that the retailer actually sells (POS product → UHTD part mapping)
- Applies qualifier filtering (sanitization system, voltage, etc.) from the Qdb
- Displays the retailer's products with the retailer's pricing and inventory

> **Key Distinction:** Customers never see the full UHTD catalog. They only see products from their retailer's inventory that happen to be compatible with their spa. The UHTD is the compatibility engine behind the scenes, not a customer-facing catalog. The UHTD contains no pricing whatsoever — all pricing comes exclusively from the tenant's POS system.

## 1.2 Tenant Relationship to UHTD

The UHTD is global, shared across all tenants, and read-only for tenants. Only super admins can create, edit, or delete UHTD data. Tenants interact with the UHTD in two ways:

- **Reading:** Tenant apps query the UHTD to determine spa-part compatibility. The public SCdb API is available during spa registration so customers can select their model.
- **Mapping:** Retailer admins map their POS products to UHTD parts. This mapping is tenant-specific and stored in the pos_products table, not in the UHTD itself. The system auto-maps where possible using SKU, UPC, and name matching.

## 1.3 Mapping Connection Points

To make tenant product mapping as automatic as possible, the UHTD stores multiple identification fields that can match against POS product data:

| UHTD Field | POS Equivalent | Match Quality |
|---|---|---|
| `pcdb_parts.upc` | POS product barcode/UPC | Highest — universal barcode is the gold standard for auto-matching |
| `pcdb_parts.ean` | POS product EAN (international) | Highest — same as UPC but for international products |
| `pcdb_parts.part_number` | POS product SKU | High — manufacturer part numbers often match retailer SKUs directly |
| `pcdb_parts.sku_aliases` | POS product SKU (alternate formats) | High — catches common reformatting (hyphens, spaces, prefixes) |
| `pcdb_parts.name` | POS product title | Medium — fuzzy string matching, less reliable |
| `pcdb_parts.manufacturer` | POS product vendor | Supporting — helps confirm other matches |
| `scdb_spa_models.manufacturer_sku` | POS spa product SKU | High — for retailers who sell spa units through POS |

The more of these fields the UHTD has populated, the higher the auto-mapping success rate. Data entry should prioritize UPC/EAN and part_number fields because they yield the highest-confidence automatic matches.

## 1.4 Tenant Data Correction Requests

Retailers may notice missing spa models, incorrect specs, or wrong compatibility data. They can submit structured correction requests from their admin dashboard. Each request includes:

- Request type: Missing model, wrong specs, wrong compatibility, missing part, other
- Description of the issue (free text)
- Source or reference link (optional)
- Affected entity: brand, model, part, or Comp ID if known

Requests go into a super admin review queue. Super admins investigate, make corrections to the UHTD if warranted, and mark the request as resolved with notes.

---

# 2. Three-Database Architecture

The UHTD consists of three logical databases, each with a distinct responsibility:

| Database | Full Name | Purpose |
|---|---|---|
| **SCdb** | Spa Configuration Database | All spas, hot tubs, swim spas — the "equipment." Brands, model lines, individual model-year records, and specifications. |
| **PCdb** | Parts Catalog Database | All parts, components, and accessories. Every manufacturer's version of every part, categories, interchange groups, and the source-of-truth compatibility table. |
| **Qdb** | Qualifier Database | Additional attributes that affect compatibility: sanitization system, voltage requirement, ozone/UV/salt compatibility. |

These three databases are joined by two bridge systems:

- **part_spa_compatibility:** The single source of truth for which parts fit which spas. Every compatibility relationship traces back to this table.
- **Compatibility Groups (Comps):** Named groupings of spas that share part compatibility. A data-entry and organizational tool — part membership in a Comp is always computed from part_spa_compatibility, never stored.

## 2.1 Column Naming Convention

All tables use `id` as the primary key column name. This is the industry standard for ORMs (Prisma, TypeORM, Sequelize) and keeps join patterns predictable. Foreign key columns use descriptive names that reference the parent table (e.g., `brand_id`, `model_line_id`, `category_id`). Compatibility Groups are the sole exception: they use a VARCHAR(50) human-readable ID instead of UUID, documented in Section 6.

---

# 3. SCdb — Spa Configuration Database

The SCdb catalogs every spa, hot tub, and swim spa model. It is organized in a three-level hierarchy: Brand → Model Line → Model-Year Record.

## 3.1 Data Hierarchy

- **Brand:** The manufacturer (e.g., Jacuzzi, Sundance, Hydropool). Stores name, logo, website, and active status.
- **Model Line:** A product family within a brand (e.g., J-300 Collection, J-400 Designer Collection). Groups related models together.
- **Model-Year Record:** A specific model for a specific individual year (e.g., J-335 2019, J-335 2020, J-335 2021). This is the atomic unit of compatibility. Every year gets its own row.

> **Individual Year Strategy — Bloated by Design:** Every individual year gets its own database record. A J-335 sold from 2019 through 2024 creates 6 rows, even if nothing changed mechanically between years. This is intentional. The UHTD is bloated on purpose because: (1) We never have to retroactively split year ranges when a mid-year revision surfaces. (2) Every customer can find their exact year without ambiguity. (3) Part compatibility is mapped at the year level, so a change in any single year is a simple row edit, not a range split. (4) It mirrors how customers think — they know "I have a 2021 J-335," not "I have a 2019–2021-range J-335."

## 3.2 SCdb Tables

### scdb_brands

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Primary key |
| name | VARCHAR(100), UNIQUE | Brand name: 'Jacuzzi', 'Sundance', etc. |
| logo_url | TEXT | URL to brand logo image |
| website_url | TEXT | Manufacturer website |
| is_active | BOOLEAN, DEFAULT true | Whether brand is actively manufacturing |
| deleted_at | TIMESTAMPTZ, NULLABLE | Soft delete timestamp (NULL = active) |
| data_source | VARCHAR(100) | Where this data came from (see Section 9) |
| created_at / updated_at | TIMESTAMPTZ | Audit timestamps |

```sql
CREATE TABLE scdb_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  logo_url TEXT,
  website_url TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  data_source VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scdb_brands_name ON scdb_brands(name);
CREATE INDEX idx_scdb_brands_active ON scdb_brands(is_active) WHERE deleted_at IS NULL;
```

### scdb_model_lines

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Primary key |
| brand_id | UUID (FK → scdb_brands) | Parent brand |
| name | VARCHAR(150), UNIQUE per brand | Line name: 'J-300 Collection' |
| description | TEXT | Optional description |
| is_active | BOOLEAN, DEFAULT true | Whether line is actively sold |
| deleted_at | TIMESTAMPTZ, NULLABLE | Soft delete timestamp |
| data_source | VARCHAR(100) | Where this data came from |
| created_at / updated_at | TIMESTAMPTZ | Audit timestamps |

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

### scdb_spa_models (Core Table)

Each row represents a single model for a single year — the atomic unit that parts are mapped to.

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Primary key |
| model_line_id | UUID (FK → scdb_model_lines) | Parent model line |
| brand_id | UUID (FK → scdb_brands) | Parent brand (denormalized for query efficiency) |
| name | VARCHAR(150), NOT NULL | Model name: 'J-335' |
| year | INTEGER, NOT NULL | Individual model year (2019, 2020, 2021, etc.) |
| manufacturer_sku | VARCHAR(100) | Manufacturer's SKU/product code for POS mapping |
| **SPECIFICATIONS** | | |
| water_capacity_gallons | INTEGER | Water volume |
| jet_count | INTEGER | Number of jets |
| seating_capacity | INTEGER | Number of seats |
| dimensions_length_inches | INTEGER | Length in inches |
| dimensions_width_inches | INTEGER | Width in inches |
| dimensions_height_inches | INTEGER | Height in inches |
| weight_dry_lbs | INTEGER | Dry weight |
| weight_filled_lbs | INTEGER | Filled weight |
| electrical_requirement | VARCHAR(50) | '240V/50A', '120V/15A', etc. |
| **FEATURES** | | |
| has_ozone | BOOLEAN, DEFAULT false | Built-in ozone system |
| has_uv | BOOLEAN, DEFAULT false | Built-in UV sanitization |
| has_salt_system | BOOLEAN, DEFAULT false | Built-in salt system |
| **MEDIA & STATUS** | | |
| image_url | TEXT | Product image URL |
| spec_sheet_url | TEXT | Spec sheet URL |
| is_discontinued | BOOLEAN, DEFAULT false | No longer produced |
| notes | TEXT | Internal notes |
| data_source | VARCHAR(100) | Where this data came from |
| deleted_at | TIMESTAMPTZ, NULLABLE | Soft delete timestamp |
| created_at / updated_at | TIMESTAMPTZ | Audit timestamps |

Unique constraint: `(model_line_id, name, year)` — no duplicate model-year combinations within a model line.

```sql
CREATE TABLE scdb_spa_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_line_id UUID NOT NULL REFERENCES scdb_model_lines(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES scdb_brands(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  year INTEGER NOT NULL,
  manufacturer_sku VARCHAR(100),

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

## 3.3 Consumer Flow

The mobile app presents spa selection as: Brand → Year → Model. This is a UI convenience — internally the data is Brand → Model Line → Model-Year Record. The API computes available years by querying `DISTINCT year` values across all models in a brand.

## 3.4 Tenant Brand Visibility

While all brands exist globally in the UHTD, tenants may want to restrict which brands appear during spa registration. A `tenant_brand_visibility` table (tenant-scoped, outside the UHTD) controls this:

- **Default behavior:** All brands are visible. Customers who own any spa brand can register it.
- **Override:** Retailer can hide brands they don't carry. The customer's spa data remains valid even if the brand is hidden later.

---

# 4. PCdb — Parts Catalog Database

The PCdb catalogs every part, component, accessory, and chemical that can be associated with a spa. It is intentionally comprehensive — every manufacturer's version of a part gets its own entry, even when cross-brand equivalents exist. If Pleatco, Unicel, and Filbur all make the same filter, that's three rows in pcdb_parts. Any tenant might sell any of them, so every one must be available for mapping.

## 4.1 Part Categories

Parts are organized into categories. Categories are seeded at setup and extensible by super admins.

| Category | Display Name | Sort Order |
|---|---|---|
| filter | Filters | 1 |
| cover | Covers | 2 |
| chemical | Chemicals | 3 |
| pump | Pumps | 4 |
| jet | Jets | 5 |
| heater | Heaters | 6 |
| control_panel | Control Panels | 7 |
| pillow | Pillows & Headrests | 8 |
| cover_lifter | Cover Lifters | 9 |
| steps | Steps & Accessories | 10 |
| ozonator | Ozonators | 11 |
| circulation_pump | Circulation Pumps | 12 |
| blower | Blowers | 13 |
| light | Lights | 14 |
| plumbing | Plumbing & Fittings | 15 |

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

## 4.2 pcdb_parts Table

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Primary key |
| category_id | UUID (FK → pcdb_categories) | Part category |
| **IDENTIFICATION** | | |
| part_number | VARCHAR(100) | Manufacturer part number: '6000-383A' |
| upc | VARCHAR(20) | Universal Product Code (barcode) — primary auto-mapping signal |
| ean | VARCHAR(20) | European Article Number (international barcode) |
| sku_aliases | TEXT[] | Array of alternate SKU formats for fuzzy matching. E.g., ['6000383A', 'J-6000-383A'] |
| name | VARCHAR(255), NOT NULL | Display name: 'ProClear 6000-383A Filter' |
| manufacturer | VARCHAR(100) | Manufacturer: 'Jacuzzi', 'Pleatco', 'Balboa' |
| **CLASSIFICATION** | | |
| interchange_group_id | UUID (FK → pcdb_interchange_groups), NULLABLE | Equivalent part group (see 4.3) |
| is_oem | BOOLEAN, DEFAULT false | Original equipment manufacturer part |
| is_universal | BOOLEAN, DEFAULT false | Fits all spas — skip compatibility check (see 4.5) |
| is_discontinued | BOOLEAN, DEFAULT false | Part no longer manufactured |
| discontinued_at | TIMESTAMPTZ, NULLABLE | When the part was marked discontinued |
| display_importance | INTEGER, DEFAULT 2 | Sort priority: 1=OEM/premium, 2=standard, 3=third-party |
| **PHYSICAL & MEDIA** | | |
| dimensions_json | JSONB | Physical dimensions: {length, diameter, unit} |
| image_url | TEXT | Product image URL |
| spec_sheet_url | TEXT | Spec sheet URL |
| **METADATA** | | |
| notes | TEXT | Internal notes |
| data_source | VARCHAR(100) | Where this data came from |
| deleted_at | TIMESTAMPTZ, NULLABLE | Soft delete timestamp |
| created_at / updated_at | TIMESTAMPTZ | Audit timestamps |

> **Display Importance Sorting:** When a customer sees multiple compatible products, display_importance controls the order. OEM parts (1) appear above standard aftermarket (2), which appear above generic/third-party (3). Within the same importance level, products sort alphabetically. This keeps brand partners happy while still showing all options.

```sql
CREATE TABLE pcdb_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES pcdb_categories(id) ON DELETE RESTRICT,

  -- Identification
  part_number VARCHAR(100),
  upc VARCHAR(20),
  ean VARCHAR(20),
  sku_aliases TEXT[],
  name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(100),

  -- Classification
  interchange_group_id UUID REFERENCES pcdb_interchange_groups(id),
  is_oem BOOLEAN DEFAULT false,
  is_universal BOOLEAN DEFAULT false,
  is_discontinued BOOLEAN DEFAULT false,
  discontinued_at TIMESTAMPTZ,
  display_importance INTEGER DEFAULT 2,

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

CREATE INDEX idx_pcdb_parts_category ON pcdb_parts(category_id);
CREATE INDEX idx_pcdb_parts_number ON pcdb_parts(part_number);
CREATE INDEX idx_pcdb_parts_upc ON pcdb_parts(upc) WHERE upc IS NOT NULL;
CREATE INDEX idx_pcdb_parts_ean ON pcdb_parts(ean) WHERE ean IS NOT NULL;
CREATE INDEX idx_pcdb_parts_manufacturer ON pcdb_parts(manufacturer);
CREATE INDEX idx_pcdb_parts_interchange ON pcdb_parts(interchange_group_id) WHERE interchange_group_id IS NOT NULL;
CREATE INDEX idx_pcdb_parts_name ON pcdb_parts USING gin(to_tsvector('english', name));
CREATE INDEX idx_pcdb_parts_sku_aliases ON pcdb_parts USING gin(sku_aliases) WHERE sku_aliases IS NOT NULL;
CREATE INDEX idx_pcdb_parts_active ON pcdb_parts(category_id) WHERE deleted_at IS NULL;
```

## 4.3 Interchange Groups

Many parts have cross-brand equivalents. A Pleatco 6CH-961, Unicel C-6660, and Filbur FC-2715 are all the same physical filter. Each one is its own row in pcdb_parts — they are separate entries that can be independently mapped by different tenants. The interchange group simply says "these parts are equivalent."

> **Every Part Gets Its Own Entry:** The UHTD does NOT collapse equivalent parts into a single record. Pleatco, Unicel, and Filbur each get their own pcdb_parts row with their own part_number, UPC, and name. Tenant A might sell Pleatco, Tenant B might sell Unicel — both need a UHTD entry to map to. The interchange group is a cross-reference, not a deduplication tool.

### pcdb_interchange_groups Table

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Primary key |
| name | VARCHAR(255) | Human-readable name: 'J-300/J-400 ProClear Filter Equivalents' |
| notes | TEXT | Optional context about the interchange |
| created_at | TIMESTAMPTZ | Audit timestamp |

```sql
CREATE TABLE pcdb_interchange_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

All equivalent parts share the same `interchange_group_id` on pcdb_parts. To find all equivalents for a given part, query all parts with the same interchange_group_id. This is O(1) lookup, scales to any number of equivalents, and requires no separate join table.

When a part is added to an interchange group, the system should verify (or copy) compatibility data from the group's existing parts, since equivalent parts should share the same spa compatibility set.

## 4.4 Part Identification for POS Mapping

The combination of `upc`, `ean`, `part_number`, and `sku_aliases` gives the auto-mapping algorithm multiple signals to match against tenant POS data. Priority order for matching:

- **UPC/EAN exact match:** Highest confidence. Universal barcodes are unambiguous.
- **Part number exact match:** High confidence. Manufacturer part numbers often match retailer SKUs.
- **SKU alias match:** High confidence. Catches reformatting (hyphens removed, prefixes added).
- **Name similarity:** Medium confidence. Fuzzy matching as fallback.
- **Manufacturer/vendor match:** Supporting signal. Confirms other matches.

Data entry should prioritize populating UPC/EAN and part_number fields because they yield the highest-confidence automatic matches.

## 4.5 Universal Parts Handling

Parts marked `is_universal=true` (e.g., pH test strips, generic spa cleaner) fit every spa. Rather than creating thousands of rows in part_spa_compatibility, the query layer short-circuits: if a part's is_universal flag is true, it passes the compatibility check for any spa automatically. Universal parts are never added to part_spa_compatibility and are never included in Comp calculations.

## 4.6 Discontinued Part Handling

When a UHTD part is marked discontinued:

- POS products mapped to it retain their mapping but gain a 'discontinued_uhtd_part' flag in the API response.
- Retailer admins see a warning on their product mapping dashboard suggesting they remap or verify.
- The part remains in its interchange group so customers can find active alternatives.
- Comps that include the part continue to show it (still historically compatible) but the part is visually flagged.
- Customer-facing product listings hide products mapped to discontinued UHTD parts unless the retailer's POS product is still active and in stock.

---

# 5. The Source of Truth: part_spa_compatibility

This is the most important table in the entire system. Every compatibility relationship — whether entered manually, bulk imported, or derived from a Comp assignment — materializes as a row in this table.

## 5.1 Table Schema

| Column | Type | Description |
|---|---|---|
| part_id | UUID (FK → pcdb_parts), PK | The part |
| spa_model_id | UUID (FK → scdb_spa_models), PK | The spa model-year record |
| status | VARCHAR(20), DEFAULT 'confirmed' | 'confirmed' (live), 'pending' (awaiting review), 'rejected' |
| **COMPATIBILITY DETAILS** | | |
| fit_notes | TEXT, NULLABLE | Caveats: 'requires adapter bracket', 'only fits models with 2-inch plumbing' |
| quantity_required | INTEGER, DEFAULT 1 | How many of this part the spa needs (e.g., 2 filters) |
| position | VARCHAR(100), NULLABLE | Where the part goes: 'primary pump', 'circulation pump', 'top filter', 'bottom filter' |
| **PROVENANCE** | | |
| source | VARCHAR(50) | 'manual', 'comp_assignment', 'bulk_import', 'auto_detected' |
| added_by | UUID | User who added this record |
| added_at | TIMESTAMPTZ | When it was added |
| reviewed_by | UUID, NULLABLE | User who reviewed (if pending → confirmed) |
| reviewed_at | TIMESTAMPTZ, NULLABLE | When it was reviewed |

> **Why fit_notes, quantity_required, and position Matter:** Pure yes/no compatibility isn't always sufficient. A spa might need 2 of the same filter (quantity_required=2). A J-365 might have both a 'primary pump' and a 'circulation pump' slot that take different parts (position). And sometimes a part fits but with a caveat like 'requires adapter bracket for pre-2021 models' (fit_notes). These fields let the customer-facing app show precise, actionable information rather than just a list of compatible parts.

```sql
CREATE TABLE part_spa_compatibility (
  part_id UUID NOT NULL REFERENCES pcdb_parts(id) ON DELETE CASCADE,
  spa_model_id UUID NOT NULL REFERENCES scdb_spa_models(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'confirmed',

  -- Compatibility details
  fit_notes TEXT,
  quantity_required INTEGER DEFAULT 1,
  position VARCHAR(100),

  -- Provenance
  source VARCHAR(50),
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

## 5.2 The Pending/Confirmed Workflow

Bulk imports and auto-detected mappings enter as `status='pending'`. Manual entries from super admins enter as `status='confirmed'` by default. Pending records are visible in the super admin review queue but are excluded from customer-facing compatibility queries until confirmed. This prevents bad data from propagating to Comps and product listings.

> **Query Implication:** All customer-facing queries must include `WHERE status = 'confirmed'` on part_spa_compatibility. The super admin interface shows all statuses with filtering.

---

# 6. Compatibility Groups (Comps)

## 6.1 The Problem Comps Solve

With individual year records, the mapping explosion is even more pronounced. If 50 Jacuzzi model-year records use the same filter, and there are 4 equivalent filters, that's 200 rows in part_spa_compatibility. Across 15 categories and 6 brands, manual data entry at this granularity is not feasible without Comps.

## 6.2 What Comps Are

A Comp is a named grouping of spa model-year records that share part compatibility. Key principles:

- A Comp is defined by its set of spas (stored in the `comp_spas` table).
- A part appears in a Comp if it is compatible with **ALL** spas in that Comp (computed from part_spa_compatibility).
- Comps do not store parts. There is no comp_parts table. Part membership is always computed dynamically.
- Comps auto-generate when 2+ parts in the same category share 2+ identical spas.
- Comps can be manually created for edge cases.
- After creation, Comps are category-agnostic — parts from any category can match.
- Subset Comps are valid and necessary. A Comp of 12 spas can coexist with a Comp of 47 spas even if the 12 are a subset of the 47. Parts that only fit the 12 need their own Comp.

> **Traditional vs. Comp Approach:** Without Comps: Adding a new filter that fits 50 spa-year records requires 50 individual clicks/rows in part_spa_compatibility. With Comps: Click COMP-JAC-FILT-001, which already contains those 50 spa-year records. The system adds all 50 rows to part_spa_compatibility automatically. One click instead of 50.

## 6.3 Comp Tables

### compatibility_groups

| Column | Type | Description |
|---|---|---|
| id | VARCHAR(50) (PK) | Human-readable ID: COMP-JAC-FILT-001 |
| name | VARCHAR(255) | Optional display name: 'J-300/J-400 ProClear Filter Group' |
| description | TEXT | Context and notes |
| auto_generated | BOOLEAN, DEFAULT false | Whether system created this Comp |
| source_category_id | UUID (FK → pcdb_categories) | Category that triggered auto-generation (NULL for manual) |
| created_by | UUID | User who created (NULL if auto-generated) |
| deleted_at | TIMESTAMPTZ, NULLABLE | Soft delete timestamp |
| created_at / updated_at | TIMESTAMPTZ | Audit timestamps |

> **VARCHAR(50) vs UUID for Comp IDs:** Comp IDs use human-readable VARCHAR(50) format (e.g., COMP-JAC-FILT-001) rather than UUIDs. This is intentional: Comp IDs appear in bulk import CSVs, admin dashboards, and debug logs. A readable ID dramatically speeds up data entry and troubleshooting. All other UHTD tables use UUID primary keys. The API layer must handle this mixed-key approach consistently.

```sql
CREATE TABLE compatibility_groups (
  id VARCHAR(50) PRIMARY KEY,
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
```

### comp_spas

| Column | Type | Description |
|---|---|---|
| comp_id | VARCHAR(50) (FK → compatibility_groups), PK | Parent Comp |
| spa_model_id | UUID (FK → scdb_spa_models), PK | Spa model-year record in this Comp |
| added_at | TIMESTAMPTZ | When added |

```sql
CREATE TABLE comp_spas (
  comp_id VARCHAR(50) NOT NULL REFERENCES compatibility_groups(id) ON DELETE CASCADE,
  spa_model_id UUID NOT NULL REFERENCES scdb_spa_models(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (comp_id, spa_model_id)
);

CREATE INDEX idx_comp_spas_comp ON comp_spas(comp_id);
CREATE INDEX idx_comp_spas_spa ON comp_spas(spa_model_id);
```

**Note:** There is NO `comp_parts` table. Part membership is computed dynamically.

## 6.4 Comp ID Naming Convention

Auto-generated Comp IDs follow a meaningful format:

```
COMP-{BRAND_CODE}-{CATEGORY_CODE}-{SEQUENCE}

Examples:
  COMP-JAC-FILT-001   (Jacuzzi filters)
  COMP-SUND-PUMP-003  (Sundance pumps)
  COMP-MULTI-COV-012  (Multiple brands, covers)
  COMP-CUSTOM-001     (Manually created)
```

## 6.5 Comp Auto-Generation Rules

After adding part compatibility, the system checks whether a new Comp should be created:

1. Get all spas the part is compatible with. If fewer than 2 spas, stop.
2. Find other parts in the same category with the identical spa set. If fewer than 2 parts share the set, stop.
3. Check if a Comp already exists with this exact spa set. If yes, stop.
4. Check for subset/superset relationships with existing Comps. Both the new Comp and existing Comps remain valid — subset Comps serve parts with narrower compatibility. No deduplication occurs.
5. Create the new Comp with `auto_generated=true` and the source category.

```typescript
async function checkAndCreateComps(partId: string, categoryId: string) {
  const partSpas = await getPartSpas(partId);
  if (partSpas.length < 2) return;

  const matchingParts = await findPartsWithIdenticalSpas(categoryId, partSpas);
  if (matchingParts.length < 2) return;

  const existingComp = await findCompByExactSpaSet(partSpas);
  if (existingComp) return;

  // Subset/superset Comps are allowed — no deduplication needed
  const compId = generateCompId(partSpas, categoryId);
  await createComp(compId, partSpas, categoryId, { autoGenerated: true });
}
```

## 6.6 Near-Match Comp Suggestions

When a super admin is adding or editing a part, the UI shows existing Comps ranked by overlap with the part's current spa set. Overlap is calculated as: (matching spas ÷ total Comp spas) × 100. Comps with ≥80% overlap are highlighted as near-matches. The admin can click a near-match to instantly select all its spas, then add or remove individual spas as needed.

```sql
-- Find Comps with >= 80% overlap with the part's spa set
WITH part_spas AS (
  SELECT spa_model_id FROM part_spa_compatibility WHERE part_id = $partId
),
comp_overlap AS (
  SELECT
    cs.comp_id,
    COUNT(*) AS matching_spas,
    (SELECT COUNT(*) FROM comp_spas WHERE comp_id = cs.comp_id) AS total_comp_spas,
    (SELECT COUNT(*) FROM part_spas) AS total_part_spas
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

## 6.7 Querying Parts in a Comp

Since part membership is computed, the query finds all parts compatible with every spa in the Comp:

```sql
SELECT p.*
FROM pcdb_parts p
JOIN part_spa_compatibility psc ON p.id = psc.part_id
JOIN comp_spas cs ON psc.spa_model_id = cs.spa_model_id
WHERE cs.comp_id = 'COMP-001'
  AND psc.status = 'confirmed'
  AND p.deleted_at IS NULL
GROUP BY p.id
HAVING COUNT(DISTINCT psc.spa_model_id) = (
  SELECT COUNT(*) FROM comp_spas WHERE comp_id = 'COMP-001'
);
```

## 6.8 Comp Edit Cascading

When spas are added to or removed from a Comp, the system cascades changes to part_spa_compatibility:

- **Adding a spa to a Comp:** For every part currently in the Comp (computed), add a row to part_spa_compatibility for the new spa. Source: 'comp_assignment'.
- **Removing a spa from a Comp:** For parts that ONLY have compatibility with that spa via this Comp (source='comp_assignment' and no other path), remove the part_spa_compatibility row. Parts with manually-entered compatibility retain it.

---

# 7. Qdb — Qualifier Database

The Qdb stores additional attributes that refine compatibility beyond "part fits spa." A chlorine chemical is compatible with a spa at the physical level, but if the customer uses a bromine sanitization system, showing chlorine products is unhelpful. Qualifiers solve this.

## 7.1 Qualifier Types

| Qualifier | Data Type | Applies To | Values |
|---|---|---|---|
| sanitization_system | enum | spa + part | bromine, chlorine, frog_ease, copper, silver_mineral |
| voltage_requirement | enum | spa + part | 120V, 240V |
| ozone_compatible | boolean | part | true/false |
| uv_compatible | boolean | part | true/false |
| salt_compatible | boolean | part | true/false |

## 7.2 Qualifier Tables

- **qdb_qualifiers:** Defines each qualifier (name, data type, allowed values, whether it applies to spas, parts, or both).
- **qdb_spa_qualifiers:** Assigns qualifier values to spa model-year records (e.g., J-335 2022 uses bromine sanitization).
- **qdb_part_qualifiers:** Assigns qualifier values to parts. Includes an `is_required` flag: if true, the part REQUIRES this qualifier to match the spa's qualifier. If false, informational only.

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
  is_required BOOLEAN DEFAULT false,

  PRIMARY KEY (part_id, qualifier_id)
);

CREATE INDEX idx_qdb_part_qualifiers_part ON qdb_part_qualifiers(part_id);
```

## 7.3 Qualifier Filtering Logic

When serving products to a customer, qualifier filtering works as follows:

- If a part has no qualifier requirements (no rows in qdb_part_qualifiers with is_required=true), it passes the qualifier check unconditionally.
- If a part has a required qualifier, the customer's spa must have a matching value for that qualifier.
- Multiple required qualifiers are ANDed together.

---

# 8. POS Integration & Product Mapping

The UHTD contains no pricing or inventory. All product pricing, stock levels, images, and catalog data come from each tenant's POS system via a standardized adapter pattern.

## 8.1 POS Adapter Interface

All POS integrations implement a common interface so the sync service is POS-agnostic:

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

## 8.2 Product Sync Table (pos_products)

Synced products from the tenant's POS are stored tenant-scoped. Each variant is its own row so it can be independently mapped to a UHTD part.

| Column Group | Key Columns | Description |
|---|---|---|
| Identity | id, tenant_id, pos_product_id, pos_variant_id | UUID PK, tenant FK, POS identifiers. Each variant = separate row. |
| Product Data | title, description, vendor, product_type, tags[], sku, barcode, images, price (cents), compare_at_price, inventory_quantity, weight | All sourced from POS. Price in cents (integer). No UHTD pricing. |
| Visibility | is_hidden, hidden_at, hidden_by | Retailer can hide products from their app. |
| UHTD Mapping | uhtd_part_id (FK), mapping_status, mapping_confidence, mapped_by, mapped_at | Links to PCdb part. Status: unmapped, auto_suggested, confirmed. |
| Sync Metadata | pos_status, pos_updated_at, last_synced_at, sync_hash | Tracks sync state. sync_hash detects changes. |

```sql
CREATE TABLE pos_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pos_product_id VARCHAR(255) NOT NULL,
  pos_variant_id VARCHAR(255),

  title VARCHAR(500) NOT NULL,
  description TEXT,
  vendor VARCHAR(255),
  product_type VARCHAR(255),
  tags TEXT[],
  price INTEGER NOT NULL,  -- cents
  compare_at_price INTEGER,
  sku VARCHAR(255),
  barcode VARCHAR(50),
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

## 8.3 Auto-Mapping Algorithm

When products sync, the system attempts automatic mapping to UHTD parts. The confidence score (0.00–1.00) is calculated from weighted signals:

| Signal | Weight | Method |
|---|---|---|
| UPC/EAN Exact Match | 0.60 | pos_products.barcode matches pcdb_parts.upc or ean |
| SKU/Part Number Exact Match | 0.50 | pos_products.sku matches pcdb_parts.part_number exactly |
| SKU Alias Match | 0.40 | pos_products.sku matches any value in pcdb_parts.sku_aliases |
| SKU/Part Number Partial Match | 0.25 | Normalized substring match (strip hyphens, spaces, lowercase) |
| Product Name Similarity | 0.25 | Trigram similarity (pg_trgm) or Levenshtein distance |
| Manufacturer/Vendor Match | 0.15 | pos_products.vendor matches pcdb_parts.manufacturer |
| Category Inference | 0.10 | POS product_type or tags mapped to pcdb_categories |

Scoring rules: weights are additive, capped at 1.00. A score ≥0.80 sets `mapping_status='auto_suggested'` and surfaces the match for one-click confirmation. A score ≥0.95 (UPC match or exact SKU + name match) could optionally auto-confirm. Scores below 0.80 remain 'unmapped' and require manual mapping. The system evaluates all signals and picks the highest-scoring UHTD part candidate.

## 8.4 Variant Handling

POS products often have variants (e.g., a chemical in 2 lb, 5 lb, 10 lb sizes). Each variant is stored as its own pos_products row and mapped independently:

- A Shopify product with 3 variants becomes 3 pos_products rows, each with its own pos_variant_id, price, inventory, and SKU/barcode.
- Each variant can map to a different UHTD part (or the same one if they're size variants of the same chemical).
- Customers see each variant as a separate purchasable item with its own price and stock level.
- The sync service "explodes" multi-variant POS products into individual rows during sync, preserving the parent pos_product_id for grouping.

---

# 9. Audit Trail, Versioning & Data Provenance

The UHTD is shared across all tenants. A single incorrect edit can break compatibility queries for every retailer's customers. Comprehensive auditing is non-negotiable.

## 9.1 Audit Log

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Primary key |
| table_name | VARCHAR(100) | Which table was modified |
| record_id | VARCHAR(255) | PK of the modified record (UUID or VARCHAR for Comps) |
| action | VARCHAR(20) | 'INSERT', 'UPDATE', 'DELETE' |
| old_values | JSONB | Previous state (NULL for INSERT) |
| new_values | JSONB | New state (NULL for DELETE) |
| changed_by | UUID | User who made the change |
| changed_at | TIMESTAMPTZ | When the change occurred |
| change_reason | TEXT | Optional note explaining why |

Audited tables: scdb_spa_models, pcdb_parts, part_spa_compatibility, comp_spas, compatibility_groups, qdb_spa_qualifiers, qdb_part_qualifiers. Implemented via database triggers or application-layer middleware.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  action VARCHAR(20) NOT NULL,
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

## 9.2 Soft Deletes

Critical tables use soft deletes instead of hard deletes. A `deleted_at TIMESTAMPTZ` column (NULL when active) replaces DELETE operations with UPDATE. All queries filter `WHERE deleted_at IS NULL` by default. Super admins can view and restore soft-deleted records. Applies to: scdb_brands, scdb_model_lines, scdb_spa_models, pcdb_parts, pcdb_categories, compatibility_groups.

## 9.3 Data Source Tracking

| Source Value | Meaning |
|---|---|
| manual | Super admin entered data by hand |
| manufacturer_spec_sheet | From official manufacturer specification document |
| manufacturer_website | From manufacturer's website |
| retailer_knowledge | Retailer provided via correction request or onboarding |
| bulk_import | Entered via CSV bulk import tool |
| (blank/null) | Source unknown or not yet categorized |

This is invaluable when conflicting specs surface. If the manufacturer spec sheet says 335 gallons and a retailer says 320, the data_source column tells you which was entered and whether it needs verification.

---

# 10. Search Architecture

## 10.1 UHTD Admin Search

Super admins need unified search across all UHTD entities from a single search bar:

- Full-text search with PostgreSQL tsvector indexes on spa name, part name, part number, Comp name.
- Typo tolerance via pg_trgm (trigram matching). Install the extension and create GIN indexes with gin_trgm_ops.
- Type-filtered results grouped by type (spa, part, Comp) with counts.
- Part number and UPC search: exact and partial matches with normalized comparison (strip hyphens, spaces, lowercase).

```sql
-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for typo-tolerant search
CREATE INDEX idx_scdb_models_name_trgm ON scdb_spa_models USING gin(name gin_trgm_ops);
CREATE INDEX idx_pcdb_parts_name_trgm ON pcdb_parts USING gin(name gin_trgm_ops);
CREATE INDEX idx_pcdb_parts_number_trgm ON pcdb_parts USING gin(part_number gin_trgm_ops) WHERE part_number IS NOT NULL;
CREATE INDEX idx_comps_name_trgm ON compatibility_groups USING gin(name gin_trgm_ops) WHERE name IS NOT NULL;
```

## 10.2 Customer Product Search

Customer-facing search operates within the tenant's mapped product catalog, not the full UHTD:

- Search across product name, vendor/brand, category, and SKU from pos_products.
- Category-aware boosting: searching 'filter' prioritizes the Filters category.
- Results respect all visibility rules: not hidden, confirmed mapping, spa compatibility, qualifier match.

## 10.3 Future Consideration

PostgreSQL's full-text search and trigram matching are sufficient for launch. If catalog scale or latency becomes an issue, migrate to a dedicated search engine (Typesense or Meilisearch) with real-time index sync from PostgreSQL.

---

# 11. Customer-Facing Compatibility Query

This is the query that powers the "Shop" tab. When a customer opens their shop, the system returns only products that are from their retailer, compatible with their spa, match qualifiers, and are in stock.

## 11.1 Query Logic

1. Start with pos_products where tenant_id matches, is_hidden=false, mapping_status='confirmed'.
2. Join to pcdb_parts via uhtd_part_id.
3. For non-universal parts: join to part_spa_compatibility (status='confirmed') and verify the customer's spa model-year matches.
4. For universal parts (is_universal=true): skip the compatibility join entirely.
5. Apply qualifier filtering from qdb_part_qualifiers where is_required=true.
6. Optionally filter by in-stock (inventory_quantity > 0).
7. Order by pcdb_parts.category_id, then display_importance ASC, then pos_products.title ASC.

```sql
-- Main compatibility query
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
    OR psc.part_id IS NOT NULL         -- non-universal must have compatibility record
  )
  AND (
    pq.qualifier_id IS NULL            -- no qualifier requirement
    OR sq.value @> pq.value            -- qualifier matches
  )
ORDER BY cat.sort_order, part.display_importance, pp.title;
```

## 11.2 Response Shape

The API groups results by category and returns tenant-specific data (price, inventory, images) alongside UHTD data (part number, interchange equivalents, fit notes, quantity required, position):

```json
{
  "categories": [
    {
      "name": "Filters",
      "products": [
        {
          "pos_product_id": "...",
          "title": "ProClear 6000-383A Filter",
          "price": 4999,
          "inventory": 12,
          "images": ["..."],
          "uhtd": {
            "part_number": "6000-383A",
            "is_oem": true,
            "display_importance": 1,
            "interchange_count": 3,
            "quantity_required": 1,
            "position": "top filter",
            "fit_notes": null
          }
        }
      ]
    }
  ]
}
```

---

# 12. Super Admin UHTD Management Interface

The super admin interface is where all UHTD data is created, edited, and reviewed. Designed for efficient data entry with Comp-aware workflows.

## 12.1 Navigation Structure

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

## 12.2 Key Workflow: Adding a New Part

The part creation form has two panels:

- **Left panel — Select Compatible Spas:** Live-filtering search of all spa model-year records. Checkboxes for individual selection. Count of selected.
- **Right panel — Compatibility Groups:** Existing Comps ranked by overlap. Click to select all spas. Near-matches show percentage. Quickview popup shows Comp's contents.

Required fields include UPC/part_number (at least one), category, name, and data_source. The form also collects fit_notes, quantity_required, and position for each spa-compatibility record when relevant.

### Part Entry UI Layout

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

### Quickview Popup

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

## 12.3 Key Workflow: Bulk Import

CSV import supports Comp IDs for efficient bulk data entry:

```csv
part_number,name,category,manufacturer,upc,is_oem,comp_ids,data_source
6000-383A,ProClear 6000-383A,filter,Jacuzzi,012345678901,true,COMP-JAC-FILT-001,manufacturer_spec_sheet
6CH-961,Pleatco 6CH-961,filter,Pleatco,012345678902,false,COMP-JAC-FILT-001,manual
PUMP-2HP,Waterway Executive 2HP,pump,Waterway,,false,"COMP-JAC-PUMP-001,COMP-SUND-PUMP-002",manual
```

Import behavior: look up Comp IDs, get all spas, add to part_spa_compatibility with status='pending', then check for new Comp auto-generation.

---

# 13. API Endpoint Reference

## 13.1 Public SCdb Endpoints (No Auth, Tenant Key Only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/scdb/brands` | List active brands (filtered by tenant brand visibility) |
| GET | `/api/v1/scdb/brands/:brandId/model-lines` | Model lines for a brand |
| GET | `/api/v1/scdb/model-lines/:id/models` | Models in a model line (distinct names) |
| GET | `/api/v1/scdb/models/:modelName/years` | Available years for a model name within a line |
| GET | `/api/v1/scdb/models/:id` | Full model-year details and specifications |

## 13.2 Super Admin SCdb Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/v1/super-admin/scdb/brands` | List or create brands |
| PUT/DELETE | `/api/v1/super-admin/scdb/brands/:id` | Update or soft-delete brand |
| GET/POST | `/api/v1/super-admin/scdb/model-lines` | List or create model lines |
| PUT/DELETE | `/api/v1/super-admin/scdb/model-lines/:id` | Update or soft-delete model line |
| GET/POST | `/api/v1/super-admin/scdb/models` | List or create model-year records |
| GET/PUT/DELETE | `/api/v1/super-admin/scdb/models/:id` | Get, update, or soft-delete model-year record |
| GET | `/api/v1/super-admin/scdb/models/:id/comps` | Comps this model-year belongs to |

## 13.3 Super Admin PCdb Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/v1/super-admin/pcdb/categories` | List or create categories |
| PUT | `/api/v1/super-admin/pcdb/categories/:id` | Update category |
| GET/POST | `/api/v1/super-admin/pcdb/parts` | List or create parts |
| GET/PUT/DELETE | `/api/v1/super-admin/pcdb/parts/:id` | Get, update, or soft-delete part |
| GET | `/api/v1/super-admin/pcdb/parts/:id/spas` | Spas this part fits |
| POST | `/api/v1/super-admin/pcdb/parts/:id/spas` | Add spa compatibility (with fit_notes, quantity, position) |
| DELETE | `/api/v1/super-admin/pcdb/parts/:id/spas/:spaId` | Remove spa compatibility |
| POST | `/api/v1/super-admin/pcdb/parts/bulk-import` | CSV bulk import |
| GET/POST | `/api/v1/super-admin/pcdb/interchange-groups` | List or create interchange groups |
| GET | `/api/v1/super-admin/pcdb/interchange-groups/:id/parts` | Parts in interchange group |

## 13.4 Super Admin Comp Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/v1/super-admin/comps` | List or manually create Comps |
| GET/PUT/DELETE | `/api/v1/super-admin/comps/:id` | Get, update, or soft-delete Comp |
| GET | `/api/v1/super-admin/comps/:id/spas` | Spas in Comp |
| POST/DELETE | `/api/v1/super-admin/comps/:id/spas` | Add/remove spa (cascades to part_spa_compatibility) |
| GET | `/api/v1/super-admin/comps/:id/parts` | Computed parts in Comp (read-only) |
| GET | `/api/v1/super-admin/comps/near-matches` | Near-match Comps for a set of spa IDs |

## 13.5 Super Admin Qdb Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET/POST/PUT | `/api/v1/super-admin/qdb/qualifiers` | Manage qualifier definitions |
| GET/POST/DELETE | `/api/v1/super-admin/qdb/spas/:spaId/qualifiers` | Spa qualifier values |
| GET/POST/DELETE | `/api/v1/super-admin/qdb/parts/:partId/qualifiers` | Part qualifier requirements |

## 13.6 Super Admin Utility Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/super-admin/uhtd/stats` | Dashboard stats: totals, orphaned records, pending count |
| GET | `/api/v1/super-admin/uhtd/search` | Unified search across SCdb, PCdb, Comps |
| GET | `/api/v1/super-admin/uhtd/review-queue` | Pending compatibility records |
| PUT | `/api/v1/super-admin/uhtd/review-queue/:id` | Approve or reject pending record |
| GET | `/api/v1/super-admin/uhtd/correction-requests` | Tenant correction requests |
| PUT | `/api/v1/super-admin/uhtd/correction-requests/:id` | Resolve correction request |
| GET | `/api/v1/super-admin/uhtd/audit-log` | Filtered audit log (by table, user, date range) |

## 13.7 Retailer Admin Product Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/admin/products` | Synced products with mapping status |
| PUT | `/api/v1/admin/products/:id/visibility` | Hide/show product |
| GET | `/api/v1/admin/products/:id/uhtd-suggestions` | Top 5 UHTD matches with confidence scores |
| POST | `/api/v1/admin/products/:id/map` | Confirm UHTD part mapping |
| DELETE | `/api/v1/admin/products/:id/map` | Remove mapping |
| POST | `/api/v1/admin/products/sync` | Trigger immediate full POS sync |
| GET | `/api/v1/admin/products/sync-status` | Current sync status |
| POST | `/api/v1/admin/correction-requests` | Submit UHTD correction request |

## 13.8 Customer Product Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/products` | Product listing with filters |
| GET | `/api/v1/products/:id` | Full product details |
| GET | `/api/v1/products/compatible/:spaProfileId` | Compatible products by category (Shop tab) |
| GET | `/api/v1/products/categories` | Available categories for tenant |

---

# 14. Complete Database Schema Reference

## 14.1 SCdb Tables

| Table | Purpose | Key Relationships |
|---|---|---|
| scdb_brands | Spa manufacturers | Parent of scdb_model_lines |
| scdb_model_lines | Product families within a brand | FK → scdb_brands. Parent of scdb_spa_models |
| scdb_spa_models | Individual model-year records (atomic compatibility unit) | FK → scdb_model_lines, scdb_brands. Referenced by part_spa_compatibility, comp_spas, qdb_spa_qualifiers |

## 14.2 PCdb Tables

| Table | Purpose | Key Relationships |
|---|---|---|
| pcdb_categories | Part categories (filter, pump, chemical, etc.) | Referenced by pcdb_parts, compatibility_groups |
| pcdb_parts | Individual parts with UPC, EAN, part_number, sku_aliases | FK → pcdb_categories, pcdb_interchange_groups. Referenced by part_spa_compatibility, pos_products |
| pcdb_interchange_groups | Groups of equivalent/interchangeable parts | Referenced by pcdb_parts.interchange_group_id |

## 14.3 Compatibility Tables

| Table | Purpose | Key Relationships |
|---|---|---|
| part_spa_compatibility | SOURCE OF TRUTH: which parts fit which spas. Includes fit_notes, quantity_required, position. | FK → pcdb_parts, scdb_spa_models. Composite PK. Has status (pending/confirmed). |
| compatibility_groups | Named spa groupings for efficient data entry | VARCHAR(50) PK. Referenced by comp_spas |
| comp_spas | Spa membership in Comps | FK → compatibility_groups, scdb_spa_models. Composite PK. |

## 14.4 Qdb Tables

| Table | Purpose | Key Relationships |
|---|---|---|
| qdb_qualifiers | Qualifier definitions (sanitization, voltage, etc.) | Referenced by qdb_spa_qualifiers, qdb_part_qualifiers |
| qdb_spa_qualifiers | Qualifier values for spa model-year records | FK → scdb_spa_models, qdb_qualifiers |
| qdb_part_qualifiers | Qualifier requirements on parts (with is_required flag) | FK → pcdb_parts, qdb_qualifiers |

## 14.5 Operational Tables

| Table | Purpose | Key Relationships |
|---|---|---|
| pos_products | Tenant product catalog from POS (one row per variant) | FK → tenants, pcdb_parts (uhtd_part_id). Has barcode, sku for mapping. |
| audit_log | Change history for all UHTD modifications | References any table by name + record_id |
| correction_requests | Tenant-submitted data correction requests | FK → tenants. Structured: type, description, source, affected entity. |
| tenant_brand_visibility | Controls which brands appear in tenant's app | FK → tenants, scdb_brands |

---

*— End of UHTD Architecture Overview v2.1 —*
