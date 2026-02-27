# UHTD Data Entry Guide

**Universal Hot Tub Database - Employee Walkthrough**

This guide walks you through entering data into the UHTD (Universal Hot Tub Database) system. The UHTD powers compatibility lookups for the Hot Tub Companion app, so accuracy is crucial.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding the Data Structure](#understanding-the-data-structure)
3. [Adding a New Brand](#adding-a-new-brand)
4. [Adding Model Lines and Spa Models](#adding-model-lines-and-spa-models)
5. [Adding Parts](#adding-parts)
6. [Using Compatibility Groups (Comps)](#using-compatibility-groups-comps)
7. [Bulk CSV Import](#bulk-csv-import)
8. [Review Queue](#review-queue)
9. [Tips and Best Practices](#tips-and-best-practices)

---

## Getting Started

### Accessing the UHTD Dashboard

1. Log in to the Super Admin dashboard at `/super-admin`
2. Click **UHTD** in the sidebar
3. You'll see the UHTD Overview page with stats and quick actions

### Navigation

The UHTD section has these main areas:
- **Overview** - Stats and unified search
- **Brands** - Spa manufacturers
- **Parts** - Part catalog management
- **Comps** - Compatibility groups
- **Categories** - Part categories
- **Qualifiers** - Conditional compatibility rules
- **Review Queue** - Pending records to approve
- **Import** - Bulk CSV upload
- **Audit Log** - Change history

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

## Adding Model Lines and Spa Models

### Understanding the Hierarchy

- **Brand**: Jacuzzi
  - **Model Line**: J-300 Series
    - **Spa Model**: J-345 (2024)
    - **Spa Model**: J-345 (2025)
    - **Spa Model**: J-335 (2024)

### Adding a Model Line

1. Go to the **Brand detail page** (click on a brand name)
2. Click **+ Add Model Line**
3. Fill in:
   - **Name** (required) - e.g., "J-300 Series"
   - **Description** (optional) - Brief description
   - **Data Source** - Where you got this info
4. Click **Create Model Line**

### Adding a Spa Model

1. Go to the **Model Line detail page**
2. Click **+ Add Spa Model**
3. Fill in the required fields:
   - **Model Name** - e.g., "J-345"
   - **Model Year** - e.g., "2024"
4. Fill in optional specifications:
   - Seat count, jet count, pump count
   - Dimensions (length, width, height)
   - Gallon capacity, dry weight, wet weight
   - Voltage options
5. Click **Create Spa Model**

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

### The Two-Panel Part Form

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
   - Search for spa models
   - Click to select/deselect
   - Use "Select All" to add multiple
5. Use Comp Suggestions (right panel):
   - See groups that match your selections
   - Click a Comp to add all its spas at once
6. Click **Create Part**

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

---

## Using Compatibility Groups (Comps)

### What Are Comps?

Comps are named groups of spas that share compatible parts. Instead of selecting 50 individual spas, you can select one Comp.

### Comp ID Format

```
COMP-[BRAND]-[CATEGORY]-[NUMBER]
Example: COMP-JAC-FILT-001
```

- **BRAND**: 2-4 letter brand abbreviation
- **CATEGORY**: 2-4 letter category abbreviation
- **NUMBER**: Sequential number

### Creating a Comp

1. Go to **UHTD → Comps**
2. Click **+ Create Comp**
3. Fill in:
   - **Brand Code** - e.g., "JAC" for Jacuzzi
   - **Category Code** - e.g., "FILT" for filters
4. Click **Generate** to auto-create the ID, or type your own
5. Enter a **Name** - e.g., "Jacuzzi J-300 Series Filters"
6. Add a **Description** explaining what's in this group
7. Select spas using the right panel
8. Click **Create Comp**

### Using Comps When Adding Parts

When you're on the Part form:
1. Select a few spas manually
2. Look at the **Comp Suggestions** panel
3. Matches will show with a percentage (how many of the Comp's spas you've already selected)
4. Click **Select All** on a Comp to add all its spas

### Computed Parts

The Comp detail page shows **Computed Parts** - parts that are compatible with spas in that group. This is calculated dynamically, not stored.

---

## Bulk CSV Import

### When to Use CSV Import

- Adding many brands at once
- Adding large part catalogs
- Setting up part-spa compatibility in bulk

### Import Types

1. **Brands** - Add multiple spa brands
2. **Parts** - Add multiple parts to the catalog
3. **Compatibility** - Link parts to spas (supports Comp IDs!)

### Steps

1. Go to **UHTD → Import**
2. Select the import type
3. Click **Download Template** to get a sample CSV
4. Fill in your data following the template format
5. Upload your CSV file
6. Preview the data
7. Click **Import**

### CSV Format Tips

- First row must be column headers
- Use comma-separated values
- Quote fields containing commas
- Boolean values: use `true` or `false`

### Example: Compatibility CSV with Comp ID

```csv
partNumber,partName,brandName,modelLineName,modelName,modelYear,compId,fitNotes,dataSource
PKG-12345,,,,,,,COMP-JAC-FILT-001,Fits all J-300 filters,manual_entry
```

Using `compId` automatically adds the part to ALL spas in that Comp!

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

1. **Always specify Data Source**: This helps with auditing and corrections
2. **Use Comps for efficiency**: Group similar spas once, use the group forever
3. **Review before confirming**: Use the Review Queue regularly
4. **Check existing data first**: Search before adding to avoid duplicates

### Naming Conventions

- **Brands**: Use official names ("Jacuzzi" not "jacuzzi" or "Jacuzzi®")
- **Model Lines**: Include "Series" if that's the official name
- **Parts**: Be descriptive ("ProClarity 6000-383A Filter" not just "Filter")

### OEM vs Aftermarket

- Mark parts as **OEM** if they're made by the spa manufacturer
- The app can prioritize showing OEM parts to users
- Aftermarket parts are still valuable - don't skip them!

### Universal Parts

Only mark a part as **Universal** if it truly fits ALL spas:
- Chemicals (chlorine, bromine, etc.)
- Generic accessories
- Not filters, pumps, or spa-specific components

### Handling Unknown Data

If you're unsure about compatibility:
1. Add the record as pending
2. Add a note in the fit notes field
3. Mark for later verification

### Common Mistakes to Avoid

1. **Don't consolidate years**: Create separate entries for each year
2. **Don't guess part numbers**: Leave blank if unknown
3. **Don't skip categories**: Every part needs a category
4. **Don't forget to save**: Check for success message

---

## Need Help?

- Check the **Audit Log** to see recent changes
- Use **unified search** on the Overview page to find anything
- Contact your supervisor for questions about data accuracy

Remember: The UHTD powers real customer experiences. Accurate data means happy customers! 🛁
