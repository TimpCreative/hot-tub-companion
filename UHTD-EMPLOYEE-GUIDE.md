# UHTD Data Entry Guide

**Universal Hot Tub Database - Employee Walkthrough**

This guide walks you through entering data into the UHTD (Universal Hot Tub Database) system. The UHTD powers compatibility lookups for the Hot Tub Companion app, so accuracy is crucial.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding the Data Structure](#understanding-the-data-structure)
3. [Adding a New Brand](#adding-a-new-brand)
4. [Adding Model Lines](#adding-model-lines)
5. [Adding Spa Models](#adding-spa-models)
6. [Adding Parts](#adding-parts)
7. [Using Compatibility Groups (Comps)](#using-compatibility-groups-comps)
8. [Working with Qualifiers](#working-with-qualifiers)
9. [Bulk CSV Import](#bulk-csv-import)
10. [Merging Duplicate Entries](#merging-duplicate-entries)
11. [Review Queue](#review-queue)
12. [Tips and Best Practices](#tips-and-best-practices)

---

## Getting Started

### Accessing the UHTD Dashboard

1. Log in to the Super Admin dashboard at `https://admin.hottubcompanion.com/super-admin`
2. Click **UHTD** in the sidebar
3. You'll see the UHTD Overview page with stats and quick actions

### Navigation

The UHTD section has these main areas:
- **Overview** - Stats, unified search, and quick action buttons
- **Brands** - Spa manufacturers
- **Model Lines** - Product lines within brands
- **Spas** - Individual spa models
- **Parts** - Part catalog management
- **Comps** - Compatibility groups
- **Categories** - Part categories
- **Qualifiers** - Conditional compatibility rules
- **Review Queue** - Pending records to approve
- **Import** - Bulk CSV upload
- **Audit Log** - Change history

### Quick Actions

The Overview page has quick action buttons for common tasks:
- **Add Brand** - Create a new spa manufacturer
- **Add Model Line** - Create a new product line
- **Add Spa** - Create a new spa model
- **Add Part** - Create a new part
- **Create Comp** - Create a new compatibility group
- **Import CSV** - Bulk import data

---

## Understanding the Data Structure

### The Three Databases

**SCdb (Spa Configuration Database)**
- Brands → Model Lines → Spa Models
- Each spa model-year is a separate record (e.g., "J-345 2024" and "J-345 2025" are different entries)

**PCdb (Parts Catalog Database)**
- Categories → Parts
- Parts can be OEM (manufacturer original) or aftermarket

**Compatibility System**
- Links parts to spa models
- Uses a **pending → confirmed** workflow
- Comps group similar spas for faster data entry

---

## Adding a New Brand

### When to Add a Brand

Add a brand when you need to enter data for a manufacturer that doesn't exist yet.

### Steps

1. Go to **UHTD → Brands**
2. Click **+ Add Brand**
3. Fill in:
   - **Name** (required) - The official brand name (e.g., "Jacuzzi", "Hot Spring")
   - **Logo URL** (optional) - Direct link to the brand logo
   - **Website URL** (optional) - Brand's official website
   - **Data Source** (optional) - Where you got this info (e.g., "manufacturer catalog 2024")
4. Click **Create Brand**

### Example

```
Name: Marquis Spas
Website URL: https://marquisspas.com
Data Source: Official website
```

---

## Adding Model Lines

### Understanding the Hierarchy

- **Brand**: Jacuzzi
  - **Model Line**: J-300 Series
    - **Spa Model**: J-345 (2024)
    - **Spa Model**: J-345 (2025)
    - **Spa Model**: J-335 (2024)

### Steps to Add a Model Line

1. Go to **UHTD → Model Lines**
2. Click **+ Add Model Line**
3. Select the **Brand** from the dropdown
   - **Don't see the brand?** Click the **+** button next to the dropdown to create a new brand without leaving the page!
4. Fill in:
   - **Name** (required) - e.g., "J-300 Series"
   - **Description** (optional) - Brief description
   - **Data Source** - Where you got this info
5. Click **Create Model Line**

### Bulk Adding Model Lines

You can add multiple model lines at once:
1. Click the **Bulk Add** tab
2. Fill in the table with multiple model lines
3. Click **Add All** to create them in batch

---

## Adding Spa Models

### Steps to Add a Spa Model

1. Go to **UHTD → Spas**
2. Click **+ Add Spa**
3. Select the **Brand** from the dropdown
   - **Don't see the brand?** Click the **+** button to create a new brand inline!
4. Select the **Model Line** from the dropdown
   - **Don't see the model line?** Click the **+** button to create a new model line inline!
5. Fill in the required fields:
   - **Model Name** (required) - e.g., "J-345"
   - **Model Year(s)** (required) - Check the years this model applies to (e.g., 2005-2025). Use quick-select buttons for ranges, or check individual years. One spa record is created per selected year.
6. Fill in optional specifications:
   - **Specifications**: Seating capacity, jet count, water capacity (gallons), electrical requirement
   - **Dimensions**: Length, width, height (all in inches - enter just the number)
   - **Weight**: Dry weight and filled weight (both in lbs - enter just the number)
   - **Features**: Has Ozone, Has UV, Has Salt System checkboxes
   - **Media**: Image URL, Spec Sheet URL, Notes
7. Click **Create Spa Model**

### Bulk Adding Spa Models

You can add multiple spa models at once:
1. Click the **Bulk Add** tab
2. Fill in the table with multiple spas
3. Click **Add All** to create them in batch

### Important: Individual Year Strategy

Each year gets its own database entry, even if specs are identical. This allows for:
- Year-specific part changes
- Accurate compatibility tracking
- Future flexibility

**Example**: Even if the J-345 hasn't changed from 2023 to 2024, create both:
- J-345 (2023)
- J-345 (2024)

---

## Adding Parts

### The Three-Panel Part Form

When adding a part, you'll see a three-column layout:

1. **Left Panel** - Part details (name, category, part number, etc.)
2. **Middle Panel** - Spa selection (which spas this part fits)
3. **Right Panel** - Comp suggestions (groups to help select spas faster)

### Steps

1. Go to **UHTD → Parts**
2. Click **+ Add Part**
3. Fill in Part Details:
   - **Category** (required) - Select from dropdown
   - **Part Name** (required) - Descriptive name
   - **Part Number** - Manufacturer's part number
   - **UPC** - Universal Product Code barcode
   - **Manufacturer** - Who makes this part
   - **OEM Part** - Check if this is the manufacturer's original part
   - **Universal** - Check if this fits ALL spas
   - **Data Source** - Where you found this info
4. Select Compatible Spas (unless marking as Universal):
   - Search for spa models by name, brand, or model line
   - Click to select/deselect individual spas
   - Use "Select All" in search results to add multiple at once
5. Use Comp Suggestions (right panel):
   - See groups that match your selections
   - Click **Select All** on a Comp to add all its spas at once
   - **Create New Comp**: If you've selected spas that should form a new group, click **Create New Comp** to save this selection as a reusable Comp!
6. Click **Create Part**

### Bulk Adding Parts

You can add multiple parts at once:
1. Click the **Bulk Add** tab
2. Fill in the table with part data including:
   - Part Number, Name, Category
   - Manufacturer, UPC, Data Source
   - OEM checkbox
3. Click **Add All** to create them in batch
4. Note: Bulk-added parts need spa compatibility added separately

### Part Categories

Common categories include:
- Filters
- Pumps
- Jets
- Covers
- Chemicals
- Control Panels
- Heaters
- Pillows
- LED Lights

### Category Sort Order

When viewing or editing categories, you'll see a **Sort Order** field:
- **0** = Highest priority (appears first in lists)
- Higher numbers appear lower in the list
- Use this to order categories by importance or frequency of use

---

## Using Compatibility Groups (Comps)

### What Are Comps?

Comps are named groups of spas that share compatible parts. Instead of selecting 50 individual spas, you can select one Comp. This dramatically speeds up data entry!

### Comp ID Format

Comp IDs are human-readable identifiers:
```
COMP-[BRAND]-[CATEGORY]-[NUMBER]
Example: COMP-JAC-FILT-001
```

- **BRAND**: 2-4 letter brand abbreviation (JAC = Jacuzzi, HS = Hot Spring)
- **CATEGORY**: 2-4 letter category abbreviation (FILT = Filters, PUMP = Pumps)
- **NUMBER**: Sequential number (001, 002, etc.)

### Creating a Comp - Method 1: From the Comps Page

1. Go to **UHTD → Comps**
2. Click **+ Create Comp**
3. Fill in:
   - **Comp ID** (required) - e.g., "COMP-JAC-FILT-001"
   - **Name** (required) - e.g., "Jacuzzi J-300 Series Filters"
   - **Description** - Explain what spas are in this group and why
4. Select spas using the spa selection panel
5. Click **Create Comp**

### Creating a Comp - Method 2: From the Part Form (Inline)

This is the fastest way to create Comps while you work:

1. While adding a part, select the spas you want
2. Look at the **Comp Suggestions** sidebar on the right
3. If no existing Comp matches, click **Create New Comp**
4. The modal will show how many spas you've selected
5. Enter a Comp ID, name, and description
6. Click **Create** - your new Comp is saved and ready to use!

### Using Comps When Adding Parts

When you're on the Part form:
1. Select a few spas manually (or search and select)
2. Look at the **Comp Suggestions** panel on the right
3. Matches will show with a percentage (how many of the Comp's spas you've already selected)
4. Click **Select All** on a Comp to add all its spas instantly
5. This works both ways - if you've selected some spas, relevant Comps appear; if you select a Comp, all its spas are added

### Computed Parts

The Comp detail page shows **Computed Parts** - parts that are compatible with spas in that group. This is calculated dynamically based on the `part_spa_compatibility` table, not stored separately.

---

## Working with Qualifiers

### What Are Qualifiers?

Qualifiers add conditional compatibility rules. For example, a pump might fit a spa model but only if it's the 240V version. Qualifiers capture these "it depends" scenarios.

### Types of Qualifiers

- **Boolean** - Simple yes/no value (e.g., "Has Ozonator?")
- **Single Select** - User must pick one option (e.g., "What is your voltage?" → 120V or 240V)
- **Multi Select** - User can select multiple options (e.g., "What features does your spa have?" → LED Lights, Ozone, Waterfall)

### Creating a Qualifier

1. Go to **UHTD → Qualifiers**
2. Click **+ Add Qualifier**
3. Fill in:
   - **Internal Name** (required) - e.g., `voltage_rating` (auto-formatted to lowercase with underscores)
   - **Display Name** (required) - e.g., "Voltage Rating"
   - **Description** - Help text for users
   - **Applies To** (required) - Choose one:
     - **Spa Only** - This is an attribute of spas (e.g., "spa's voltage")
     - **Part Only** - This is a requirement of parts (e.g., "part requires 240V")
     - **Both** - Used by both spas and parts
   - **Data Type** - Boolean (Yes/No), Single Select, or Multi Select
   - **Allowed Values** - For Select types, enter comma-separated options (e.g., `120V, 240V`)
4. Click **Create Qualifier**

### Input Formatting

When entering possible values:
- Separate options with commas: `120V, 240V`
- Extra spaces are automatically trimmed (so `120V,  240V` becomes `120V, 240V`)
- Each value becomes a selectable option for the user

---

## Bulk CSV Import

### When to Use CSV Import

- Adding many brands at once
- Adding multiple model lines or spas
- Adding large part catalogs
- Setting up part-spa compatibility in bulk

### Import Types

1. **Brands** - Add multiple spa brands
2. **Model Lines** - Add multiple product lines
3. **Spas** - Add multiple spa models
4. **Parts** - Add multiple parts to the catalog
5. **Comps (Compatibility Groups)** - Link parts to spas using Comp IDs or individual spa details

### Steps

1. Go to **UHTD → Import**
2. Select the import type (click one of the 5 buttons)
3. Click **Download Template** to get a sample CSV
4. Fill in your data following the template format
5. Upload your CSV file
6. Preview the data and check for errors
7. Click **Import**

### CSV Format Tips

- First row must be column headers
- Use comma-separated values
- Quote fields containing commas
- Boolean values: use `true` or `false`

### Import Column Reference

**Brands CSV:**
- `name` (required), `logoUrl`, `websiteUrl`, `dataSource`

**Model Lines CSV:**
- `brandName` (required), `name` (required), `description`, `dataSource`

**Spas CSV (24 columns):**
- `brandName` (required) - Must exist in database
- `modelLineName` (required) - Must exist under the brand
- `name` (required) - The spa model name (e.g., "J-335")
- `year` (required) - The model year
- `manufacturerSku` - Manufacturer's part/model number
- `seatingCapacity`, `jetCount`, `waterCapacityGallons` - Numbers only
- `electricalConfig1`, `electricalConfig2` - Structured electrical options (e.g., "240V/50A", "120V/15A"). Supports formats: `240V/50A`, `240V/60Hz/50A`, `120V 15A`. Leave empty or use one column for single-config spas.
- `dimensionsLengthInches`, `dimensionsWidthInches`, `dimensionsHeightInches` - Numbers only (inches)
- `weightDryLbs`, `weightFilledLbs` - Numbers only (lbs)
- `hasOzone`, `hasUv`, `hasSaltSystem`, `hasJacuzziTrue` - Boolean (`true`/`false`)
- `imageUrl`, `specSheetUrl` - Full URLs
- `notes` - Internal notes
- `isDiscontinued` - Boolean (`true`/`false`)
- `dataSource` - Where the data came from

**Parts CSV (20 columns with smart compatibility):**

Required columns:
- `name` - Descriptive part name
- `categoryName` - Must match an existing category name

Identification columns:
- `partNumber` - Manufacturer's part number
- `manufacturerSku` - Manufacturer's SKU
- `upc` - Universal Product Code
- `ean` - European Article Number
- `skuAliases` - Comma-separated alternative SKUs

Details:
- `manufacturer` - Who makes this part
- `isOem` - Boolean: `true` if OEM part
- `isUniversal` - Boolean: `true` if fits all spas
- `isDiscontinued` - Boolean: `true` if no longer available
- `displayImportance` - Number (1-5, lower = more important)
- `imageUrl`, `specSheetUrl` - Full URLs
- `notes`, `dataSource` - Text fields

Smart Compatibility Columns (see below for details):
- `compatibleBrands` - Brand names (comma-separated)
- `compatibleModelLines` - Model line names (comma-separated)
- `compatibleSpas` - Spa model names (comma-separated)
- `compatibleYears` - Flexible format (see below)

### compatibleYears Format (Parts Import)

The `compatibleYears` column accepts flexible formats with optional spaces:

| Format | Example |
|--------|---------|
| Single year | `2024` |
| Range | `2020-2024` or `2020 - 2024` |
| Comma-separated | `2020, 2022, 2024` |
| Mix | `2002-2007, 2009, 2011- 2015` |

Spaces around hyphens and commas are trimmed. Ranges expand into individual years (e.g., `2002-2005` → 2002, 2003, 2004, 2005).

### Parts Import - Smart Compatibility

The Parts import supports assigning part-spa compatibility during import using four separate columns that work as **cascading filters**:

| Column | Contains | Example |
|--------|----------|---------|
| `compatibleBrands` | Brand names | `Jacuzzi, Hot Spring` |
| `compatibleModelLines` | Model line names | `J-300, Limelight` |
| `compatibleSpas` | Spa model names | `J-335, J-345` |
| `compatibleYears` | Year or range | `2020-2024`, `2020, 2022, 2024`, or `2002 - 2015` |

**How filters work together:**
- Brands narrow which model lines are considered
- Model lines narrow which spas are considered
- Spa names further narrow the selection
- Years filter the final result

**Examples:**

1. **All spas from a brand:**
   - `compatibleBrands`: `Jacuzzi`
   - Result: Part is compatible with ALL Jacuzzi spas (all years)

2. **All spas in a model line for certain years:**
   - `compatibleBrands`: `Jacuzzi`
   - `compatibleModelLines`: `J-300`
   - `compatibleYears`: `2020-2024`
   - Result: All J-300 spas from 2020-2024

3. **Specific spas:**
   - `compatibleBrands`: `Jacuzzi`
   - `compatibleModelLines`: `J-300`
   - `compatibleSpas`: `J-335, J-345`
   - `compatibleYears`: `2020-2022`
   - Result: Only J-335 and J-345 from 2020-2022

### Continuation Rows

For parts with complex compatibility spanning different brands or year ranges, use **continuation rows**. A continuation row has empty part info (name, categoryName) but has compatibility columns filled - it adds more compatibility to the previous part.

| name | partNumber | categoryName | compatibleBrands | compatibleModelLines | compatibleSpas | compatibleYears |
|------|------------|--------------|------------------|---------------------|----------------|-----------------|
| Filter XL | FLT-001 | filters | Jacuzzi | J-300 | J-335 | 2020-2022 |
| | | | | J-300 | J-345 | 2021-2024 |
| | | | Hot Spring | Highlife | Envoy | 2019-2023 |

- **Row 1**: Creates the "Filter XL" part and adds J-335 compatibility for 2020-2022
- **Row 2**: Adds J-345 compatibility for 2021-2024 to the same part
- **Row 3**: Adds Hot Spring Envoy compatibility for 2019-2023 to the same part

### Duplicate Part Handling

If you import a part with a `partNumber` that already exists in the database, the system will:
1. Find the existing part (won't create a duplicate)
2. Add any new compatibility from the row to the existing part
3. Report it as "existing found" in the results

### Compatibility (Comps) Import - Special Rules

The Comps import links parts to spas. There are **two methods**:

**Method 1: Using a Comp ID**
If you have an existing Comp, just provide the Comp ID:
```csv
partNumber,partName,compId,fitNotes,dataSource
PKG-12345,Filter Kit,COMP-JAC-FILT-001,Fits all J-300,catalog
```

**Method 2: Using Individual Spa Details**
Specify the exact brand, model line, spa name, and year:
```csv
partNumber,partName,brandName,modelLineName,spaName,spaYear,fitNotes,dataSource
PKG-12345,Filter Kit,Jacuzzi,J-300 Series,J-345,2024,Direct fit,catalog
```

### Important Compatibility Rules

- **Use EITHER `compId` OR spa details (brandName, etc.) - NOT BOTH**
- If you provide a `compId`, leave brandName/modelLineName/spaName/spaYear empty
- If you provide spa details, leave `compId` empty
- The system will reject rows that mix both methods with a clear error message
- All imported compatibility records start as **pending** and need to be confirmed in the Review Queue

### Auto-Create Missing Entities During Import

When importing Model Lines, Spas, or Parts, you can enable the **Auto-create missing brands/model lines** option. This is helpful when you have data that references entities that don't exist yet.

**How to Enable:**
1. On the Import page, select your import type (Model Lines, Spas, or Parts)
2. Check the **Auto-create missing brands/model lines** checkbox before uploading
3. Upload and import your CSV as normal

**What Gets Auto-Created:**

| Import Type | Auto-Creates |
|-------------|--------------|
| Model Lines | Brands |
| Spas | Brands and Model Lines |
| Parts | Categories, Brands, Model Lines, and Spas |

**Important Notes:**
- Auto-created entities have minimal data (just the name)
- They're tagged with `data_source: auto_created_during_import`
- You should review and enhance auto-created records after import
- The import results will show how many entities were auto-created

**Example Use Case:**
You have a list of spas from a new brand. Instead of:
1. Creating the brand
2. Creating all model lines
3. Importing the spas

You can simply check the auto-create box and import all spas at once. The brand and model lines will be created automatically.

---

## Merging Duplicate Entries

Sometimes duplicate entries are created - perhaps due to typos, different naming conventions, or multiple people entering data. The merge tool lets you combine duplicates into a single record while preserving all relationships.

### When to Merge

- **Same brand, different spelling**: "HotSpring" and "Hot Spring" should be one brand
- **Duplicate model lines**: "J-300" and "J-300 Series" might be the same
- **Duplicate spas**: Sometimes the same spa gets entered twice

### How to Merge Brands

1. Go to **UHTD → Brands**
2. Use the checkboxes in the first column to select 2 or more brands
3. An action bar will appear: "{n} brands selected"
4. Click **Merge Selected**
5. In the modal:
   - Choose which brand to **keep** (the target)
   - Review what will happen:
     - All model lines will move to the target brand
     - All spa models will move to the target brand
     - Visibility settings will be consolidated
   - Other brands will be soft-deleted
6. Click **Merge** to confirm

### How to Merge Model Lines

1. Go to **UHTD → Model Lines**
2. Select 2 or more model lines using checkboxes
3. Click **Merge Selected**
4. Choose which model line to keep
5. All spa models will move to the target model line
6. Click **Merge** to confirm

### How to Merge Spas

1. Go to **UHTD → Spas**
2. Select 2 or more spas using checkboxes
3. Click **Merge Selected**
4. Choose which spa to keep
5. Review affected records:
   - Part compatibility records
   - Comp assignments
   - Qualifiers
   - Electrical configs
   - User spa profiles
6. Click **Merge** to confirm

### Merge Safety

- **Preview before merge**: The modal shows exactly what will be affected
- **Non-destructive**: Source entities are soft-deleted, not permanently removed
- **Audit logged**: All merges are recorded in the Audit Log
- **No data loss**: All relationships are moved to the target entity

### Best Practices

1. **Review first**: Before merging, look at both entries to decide which one has better data
2. **Choose the best target**: Pick the entry with the most complete/accurate information
3. **Small batches**: When merging many items, do it in small batches to review each
4. **Check after merge**: Verify the target entry looks correct after merging

---

## Review Queue

### Understanding Pending vs Confirmed

- **Pending**: Not yet verified; won't show in the customer app
- **Confirmed**: Verified; appears in the app

### Reviewing Records

1. Go to **UHTD → Review Queue**
2. See all pending part-spa compatibility records
3. Use checkboxes to select multiple items
4. Click **Confirm** to approve
5. Click **Reject** to delete incorrect records

### When Records Become Pending

Records are created as "pending" when:
- Added via CSV import
- Bulk-added using Comps
- Created without explicit confirmation

---

## Tips and Best Practices

### Data Entry Tips

1. **Always specify Data Source**: This helps with auditing and corrections later
2. **Use Comps for efficiency**: Group similar spas once, use the group forever
3. **Create Comps as you go**: Use the "Create New Comp" button in the Part form whenever you find yourself selecting the same spas repeatedly
4. **Review before confirming**: Use the Review Queue regularly to approve pending records
5. **Check existing data first**: Use the unified search on the Overview page to avoid duplicates

### Inline Creation Workflow

Take advantage of inline creation to work faster:
- Adding a Model Line but the Brand doesn't exist? Click **+** to create the Brand without leaving the page
- Adding a Spa but the Model Line doesn't exist? Click **+** to create the Model Line (and even the Brand!) inline
- Adding a Part and want to save your spa selection as a Comp? Click **Create New Comp** in the sidebar

### Naming Conventions

- **Brands**: Use official names ("Jacuzzi" not "jacuzzi" or "Jacuzzi®")
- **Model Lines**: Include "Series" if that's the official name (e.g., "J-300 Series")
- **Parts**: Be descriptive ("ProClarity 6000-383A Filter" not just "Filter")
- **Comp IDs**: Follow the format `COMP-[BRAND]-[CATEGORY]-[NUMBER]` (e.g., "COMP-JAC-FILT-001")

### OEM vs Aftermarket

- Mark parts as **OEM** if they're made by the spa manufacturer
- The app can prioritize showing OEM parts to users
- Aftermarket parts are still valuable - don't skip them!

### Universal Parts

Only mark a part as **Universal** if it truly fits ALL spas:
- Chemicals (chlorine, bromine, etc.)
- Generic accessories
- NOT filters, pumps, or spa-specific components

### Handling Unknown Data

If you're unsure about compatibility:
1. Add the record - it will start as **pending**
2. Add a note in the fit notes field explaining the uncertainty
3. It won't appear in the app until confirmed in the Review Queue

### Common Mistakes to Avoid

1. **Don't consolidate years**: Create separate entries for each year, even if specs are identical
2. **Don't guess part numbers**: Leave blank if unknown - you can add them later
3. **Don't skip categories**: Every part needs a category for proper organization
4. **Don't forget to save**: Always check for the green success message
5. **Don't mix Comp ID and spa details in imports**: Use one method or the other, not both

---

## Need Help?

### Self-Service Resources

- **Audit Log** (`UHTD → Audit Log`) - See all recent changes and who made them
- **Unified Search** (`UHTD → Overview`) - Search for anything: brands, parts, spas, or comps
- **Review Queue** (`UHTD → Review Queue`) - See pending records that need confirmation

### Reporting Issues

If you encounter bugs or errors:
1. Note the exact steps that caused the issue
2. Take a screenshot if possible
3. Check the browser console for error messages (F12 → Console tab)
4. Report to your supervisor with all details

### Settings

Super Admin settings are available via **Settings** in the bottom-left of the dashboard sidebar. This shows:
- Your account information
- Other Super Admin users
- System configuration

---

Remember: The UHTD powers real customer experiences. Accurate data means happy customers! 🛁
