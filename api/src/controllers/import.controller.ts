import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import { logAudit } from '../services/audit.service';
import * as scdbService from '../services/scdb.service';
import * as qdbService from '../services/qdb.service';
import { AuditAction } from '../types/uhtd.types';

interface BrandImportRow {
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  dataSource?: string;
}

interface ModelLineImportRow {
  brandName: string;
  name: string;
  description?: string;
  dataSource?: string;
}

interface SpaModelImportRow {
  brandName: string;
  modelLineName: string;
  name: string;
  year: number;
  manufacturerSku?: string;
  seatingCapacity?: number;
  jetCount?: number;
  waterCapacityGallons?: number;
  dimensionsLengthInches?: number;
  dimensionsWidthInches?: number;
  dimensionsHeightInches?: number;
  weightDryLbs?: number;
  weightFilledLbs?: number;
  imageUrl?: string;
  specSheetUrl?: string;
  notes?: string;
  isDiscontinued?: boolean;
  dataSource?: string;
  [qualifierKey: string]: unknown; // qualifier_<name> columns
}

interface PartImportRow {
  name?: string;
  categoryName?: string;
  partNumber?: string;
  manufacturerSku?: string;
  upc?: string;
  ean?: string;
  skuAliases?: string;
  manufacturer?: string;
  isOem?: boolean;
  isUniversal?: boolean;
  isDiscontinued?: boolean;
  displayImportance?: number;
  imageUrl?: string;
  specSheetUrl?: string;
  notes?: string;
  dataSource?: string;
  // Smart compatibility columns (separate, simpler format)
  compatibleBrands?: string;
  compatibleModelLines?: string;
  compatibleSpas?: string;
  compatibleYears?: string;
}

/**
 * Parse year range string into array of individual years.
 * Supports flexible formats:
 * - "2024" (single year)
 * - "2020-2024", "2020 - 2024" (range, spaces optional)
 * - "2020, 2022, 2024" (comma-separated)
 * - "2002-2007, 2009, 2011- 2015" (mix of ranges and singles, spaces flexible)
 */
function parseYearRange(yearStr: string): number[] {
  if (!yearStr || !yearStr.trim()) return [];

  const years: number[] = [];
  const parts = yearStr.split(',').map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    const trimmed = part.trim();
    const hyphenIdx = trimmed.indexOf('-');
    if (hyphenIdx >= 0) {
      const startStr = trimmed.slice(0, hyphenIdx).trim();
      const endStr = trimmed.slice(hyphenIdx + 1).trim();
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let y = start; y <= end; y++) {
          if (!years.includes(y)) years.push(y);
        }
      }
    } else {
      const year = parseInt(trimmed, 10);
      if (!isNaN(year) && !years.includes(year)) {
        years.push(year);
      }
    }
  }

  return years.sort((a, b) => a - b);
}

/**
 * Parse electrical config string into structured fields for electrical_configs qualifier.
 * Supports formats: "240V/50A", "240V/60Hz/50A", "120V 15A", "230V 32A"
 * Returns null if unparseable.
 */
function parseElectricalConfig(
  str: string
): { voltage: number; voltageUnit: string; frequencyHz: number | null; amperage: string } | null {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  if (!s) return null;

  const voltageMatch = s.match(/(\d+)\s*V(?:AC|DC)?/i);
  const amperageMatch = s.match(/(\d+)\s*A(?:mp)?s?/i);
  const freqMatch = s.match(/(\d+)\s*Hz/i);

  if (!voltageMatch || !amperageMatch) return null;
  const voltage = parseInt(voltageMatch[1], 10);
  const amperage = `${amperageMatch[1]}A`;
  const frequencyHz = freqMatch ? parseInt(freqMatch[1], 10) : null;

  return { voltage, voltageUnit: 'VAC', frequencyHz, amperage };
}

/**
 * Parse qualifier values from import row. Extracts qualifier_<name> columns and maps
 * to qualifier IDs. Handles electrical_configs (pipe-separated "240V/50A|120V/15A"),
 * sanitization_systems (pipe-separated "ozone|uv|salt"), and enum/boolean values.
 */
function parseQualifierValuesFromRow(
  row: Record<string, unknown>,
  qualifierNameToId: Map<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    if (!key.startsWith('qualifier_') || val === undefined || val === null || val === '') continue;
    const qualifierName = key.slice('qualifier_'.length);
    const qualifierId = qualifierNameToId.get(qualifierName);
    if (!qualifierId) continue;

    const strVal = typeof val === 'string' ? val.trim() : String(val);
    if (!strVal) continue;

    if (qualifierName === 'electrical_configs') {
      const configs: { voltage: number; voltageUnit: string; frequencyHz: number | null; amperage: string }[] = [];
      const parts = strVal.split(/[|,;]/).map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        const parsed = parseElectricalConfig(part);
        if (parsed) configs.push(parsed);
      }
      if (configs.length > 0) result[qualifierId] = configs;
    } else if (qualifierName === 'sanitization_systems') {
      const systems = strVal.split(/[|,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (systems.length > 0) result[qualifierId] = systems;
    } else if (qualifierName === 'voltage_requirement') {
      result[qualifierId] = strVal;
    } else {
      try {
        const parsed = JSON.parse(strVal);
        result[qualifierId] = parsed;
      } catch {
        result[qualifierId] = strVal;
      }
    }
  }
  return result;
}

interface QualifierForFilter {
  id: string;
  name: string;
  isUniversal: boolean;
  allowedValues: { value: string; brandIds?: string[] | null }[] | string[] | null;
}

/**
 * Filter qualifier values by brand. Drops qualifiers that don't apply to the brand,
 * and drops brand-specific option values that don't match (e.g. jacuzzi_true for CalSpa).
 */
function filterQualifierValuesForBrand(
  qualifierValues: Record<string, unknown>,
  brandId: string,
  qualifierIdToQualifier: Map<string, QualifierForFilter>,
  brandQualifierIds: Set<string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [qualifierId, value] of Object.entries(qualifierValues)) {
    const qual = qualifierIdToQualifier.get(qualifierId);
    if (!qual) continue;

    if (!qual.isUniversal && !brandQualifierIds.has(qualifierId)) continue;

    if (!qual.allowedValues || !Array.isArray(qual.allowedValues)) {
      result[qualifierId] = value;
      continue;
    }

    const allowedOpts = qual.allowedValues.map((av) =>
      typeof av === 'string' ? { value: av, brandIds: null as string[] | null } : av
    );
    const validValuesForBrand = new Set<string>();
    for (const opt of allowedOpts) {
      const ids = opt.brandIds;
      if (ids == null || ids.length === 0 || ids.includes(brandId)) {
        validValuesForBrand.add(opt.value.toLowerCase());
      }
    }

    if (validValuesForBrand.size === 0) continue;

    if (Array.isArray(value)) {
      const filtered = (value as unknown[]).filter((v) => validValuesForBrand.has(String(v).toLowerCase()));
      if (filtered.length === 0) continue;
      result[qualifierId] = filtered;
    } else {
      const s = String(value).toLowerCase();
      if (!validValuesForBrand.has(s)) continue;
      result[qualifierId] = value;
    }
  }
  return result;
}

interface CompatibilityImportRow {
  partNumber?: string;
  partName?: string;
  brandName?: string;
  modelLineName?: string;
  spaName?: string;
  spaYear?: number;
  compId?: string;
  fitNotes?: string;
  dataSource?: string;
}

const SPA_BASE_HEADERS = [
  'brandName', 'modelLineName', 'name', 'year', 'manufacturerSku',
  'seatingCapacity', 'jetCount', 'waterCapacityGallons',
  'dimensionsLengthInches', 'dimensionsWidthInches', 'dimensionsHeightInches',
  'weightDryLbs', 'weightFilledLbs', 'imageUrl', 'specSheetUrl',
  'notes', 'isDiscontinued', 'dataSource',
];

const SPA_BASE_EXAMPLE = [
  'Example Brand', 'Premium Line', 'Model X', '2024', 'SKU-123',
  '6', '40', '350',
  '84', '84', '36',
  '500', '3500', 'https://...', 'https://...',
  'Notes', 'false', 'csv_import',
];

const PART_BASE_HEADERS = [
  'name', 'categoryName', 'partNumber', 'manufacturerSku', 'upc', 'ean',
  'skuAliases', 'manufacturer', 'isOem', 'isUniversal', 'isDiscontinued',
  'displayImportance', 'imageUrl', 'specSheetUrl', 'notes', 'dataSource',
  'compatibleBrands', 'compatibleModelLines', 'compatibleSpas', 'compatibleYears',
];

const PART_BASE_EXAMPLE = [
  'Filter Cartridge', 'Filters', 'ABC-123', 'MFG-456', '', '',
  '', 'Example Mfg', 'false', 'false', 'false',
  '50', 'https://...', '', 'Notes', 'csv_import',
  '', '', '', '',
];

export async function getImportTemplate(req: Request, res: Response) {
  try {
    const { type } = req.params;
    if (type !== 'spas' && type !== 'parts') {
      return error(res, 'VALIDATION_ERROR', 'type must be "spas" or "parts"', 400);
    }

    const qualifiers = await qdbService.getAllQualifiers();
    const qualifierHeaders: string[] = [];
    const qualifierExamples: string[] = [];

    if (type === 'spas') {
      const spaQualifiers = qualifiers.filter((q) => q.appliesTo === 'spa' || q.appliesTo === 'both');
      for (const q of spaQualifiers) {
        qualifierHeaders.push(`qualifier_${q.name}`);
        if (q.name === 'electrical_configs') {
          qualifierExamples.push('240V/50A|120V/15A');
        } else if (q.name === 'sanitization_systems') {
          qualifierExamples.push('ozone|uv|salt');
        } else if (q.name === 'voltage_requirement') {
          qualifierExamples.push('240V');
        } else if (q.dataType === 'array') {
          qualifierExamples.push('val1|val2');
        } else if (q.dataType === 'boolean') {
          qualifierExamples.push('true');
        } else {
          qualifierExamples.push('value');
        }
      }
      return success(res, {
        headers: [...SPA_BASE_HEADERS, ...qualifierHeaders],
        example: [...SPA_BASE_EXAMPLE, ...qualifierExamples],
      });
    }

    const partQualifiers = qualifiers.filter((q) => q.appliesTo === 'part' || q.appliesTo === 'both');
    for (const q of partQualifiers) {
      qualifierHeaders.push(`qualifier_${q.name}`);
      if (q.dataType === 'boolean') qualifierExamples.push('true');
      else if (q.dataType === 'array') qualifierExamples.push('val1|val2');
      else qualifierExamples.push('value');
    }
    return success(res, {
      headers: [...PART_BASE_HEADERS, ...qualifierHeaders],
      example: [...PART_BASE_EXAMPLE, ...qualifierExamples],
    });
  } catch (err) {
    console.error('Error getting import template:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get import template', 500);
  }
}

export async function importBrands(req: Request, res: Response) {
  try {
    const { rows } = req.body as { rows: BrandImportRow[] };
    const userId = (req as any).superAdminEmail;

    if (!rows || !Array.isArray(rows)) {
      return error(res, 'VALIDATION_ERROR', 'Rows array is required', 400);
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        if (!row.name) {
          skipped++;
          continue;
        }

        const existing = await db('scdb_brands').where('name', 'ilike', row.name).first();
        if (existing) {
          skipped++;
          continue;
        }

        const [inserted] = await db('scdb_brands')
          .insert({
            name: row.name,
            logo_url: row.logoUrl,
            website_url: row.websiteUrl,
            data_source: row.dataSource || 'csv_import',
          })
          .returning('*');

        await logAudit(
          'scdb_brands',
          inserted.id,
          'INSERT' as AuditAction,
          null,
          inserted,
          userId
        );

        created++;
      } catch (err: any) {
        errors.push(`Row "${row.name}": ${err.message}`);
      }
    }

    success(res, { created, skipped, errors }, `Imported ${created} brands`);
  } catch (err) {
    console.error('Error importing brands:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to import brands', 500);
  }
}

export async function importModelLines(req: Request, res: Response) {
  try {
    const { rows, autoCreate } = req.body as { rows: ModelLineImportRow[]; autoCreate?: boolean };
    const userId = (req as any).superAdminEmail;

    if (!rows || !Array.isArray(rows)) {
      return error(res, 'VALIDATION_ERROR', 'Rows array is required', 400);
    }

    let created = 0;
    let skipped = 0;
    let brandsAutoCreated = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      
      try {
        if (!row.brandName || !row.name) {
          errors.push(`Row ${rowNum}: brandName and name are required`);
          skipped++;
          continue;
        }

        let brand = await db('scdb_brands').where('name', 'ilike', row.brandName).first();
        if (!brand) {
          if (autoCreate) {
            // Auto-create the brand
            const [newBrand] = await db('scdb_brands')
              .insert({
                name: row.brandName,
                data_source: 'auto_created_during_import',
              })
              .returning('*');
            
            await logAudit(
              'scdb_brands',
              newBrand.id,
              'INSERT' as AuditAction,
              null,
              newBrand,
              userId
            );
            
            brand = newBrand;
            brandsAutoCreated++;
          } else {
            errors.push(`Row ${rowNum}: Brand "${row.brandName}" not found. Add the brand first or enable auto-create.`);
            skipped++;
            continue;
          }
        }

        const existing = await db('scdb_model_lines')
          .where('brand_id', brand.id)
          .where('name', 'ilike', row.name)
          .first();

        if (existing) {
          skipped++;
          continue;
        }

        const [inserted] = await db('scdb_model_lines')
          .insert({
            brand_id: brand.id,
            name: row.name,
            description: row.description || null,
            data_source: row.dataSource || 'csv_import',
          })
          .returning('*');

        await logAudit(
          'scdb_model_lines',
          inserted.id,
          'INSERT' as AuditAction,
          null,
          inserted,
          userId
        );

        created++;
      } catch (err: any) {
        errors.push(`Row ${rowNum} "${row.name}": ${err.message}`);
      }
    }

    success(res, { created, skipped, brandsAutoCreated, errors }, `Imported ${created} model lines${brandsAutoCreated > 0 ? ` (auto-created ${brandsAutoCreated} brands)` : ''}`);
  } catch (err) {
    console.error('Error importing model lines:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to import model lines', 500);
  }
}

export async function importSpas(req: Request, res: Response) {
  try {
    const { rows, autoCreate } = req.body as { rows: SpaModelImportRow[]; autoCreate?: boolean };
    const userId = (req as any).superAdminEmail;

    if (!rows || !Array.isArray(rows)) {
      return error(res, 'VALIDATION_ERROR', 'Rows array is required', 400);
    }

    const allQualifiers = await qdbService.getAllQualifiers();
    const spaQualifiers = allQualifiers.filter((q) => q.appliesTo === 'spa' || q.appliesTo === 'both');
    const qualifierNameToId = new Map(spaQualifiers.map((q) => [q.name, q.id]));
    const qualifierIdToQualifier = new Map(
      spaQualifiers.map((q) => [
        q.id,
        {
          id: q.id,
          name: q.name,
          isUniversal: q.isUniversal,
          allowedValues: q.allowedValues,
        },
      ])
    );

    let created = 0;
    let skipped = 0;
    let brandsAutoCreated = 0;
    let modelLinesAutoCreated = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      
      try {
        if (!row.brandName || !row.modelLineName || !row.name || !row.year) {
          errors.push(`Row ${rowNum}: brandName, modelLineName, name, and year are required`);
          skipped++;
          continue;
        }

        let brand = await db('scdb_brands').where('name', 'ilike', row.brandName).first();
        if (!brand) {
          if (autoCreate) {
            // Auto-create the brand
            const [newBrand] = await db('scdb_brands')
              .insert({
                name: row.brandName,
                data_source: 'auto_created_during_import',
              })
              .returning('*');
            
            await logAudit(
              'scdb_brands',
              newBrand.id,
              'INSERT' as AuditAction,
              null,
              newBrand,
              userId
            );
            
            brand = newBrand;
            brandsAutoCreated++;
          } else {
            errors.push(`Row ${rowNum}: Brand "${row.brandName}" not found. Add the brand first or enable auto-create.`);
            skipped++;
            continue;
          }
        }

        let modelLine = await db('scdb_model_lines')
          .where('brand_id', brand.id)
          .where('name', 'ilike', row.modelLineName)
          .first();

        if (!modelLine) {
          if (autoCreate) {
            // Auto-create the model line
            const [newModelLine] = await db('scdb_model_lines')
              .insert({
                brand_id: brand.id,
                name: row.modelLineName,
                data_source: 'auto_created_during_import',
              })
              .returning('*');
            
            await logAudit(
              'scdb_model_lines',
              newModelLine.id,
              'INSERT' as AuditAction,
              null,
              newModelLine,
              userId
            );
            
            modelLine = newModelLine;
            modelLinesAutoCreated++;
          } else {
            errors.push(`Row ${rowNum}: Model Line "${row.modelLineName}" not found under brand "${row.brandName}". Add the model line first or enable auto-create.`);
            skipped++;
            continue;
          }
        }

        const existing = await db('scdb_spa_models')
          .where('model_line_id', modelLine.id)
          .where('name', 'ilike', row.name)
          .where('year', row.year)
          .first();

        if (existing) {
          skipped++;
          continue;
        }

        const [inserted] = await db('scdb_spa_models')
          .insert({
            brand_id: brand.id,
            model_line_id: modelLine.id,
            name: row.name,
            year: row.year,
            manufacturer_sku: row.manufacturerSku || null,
            seating_capacity: row.seatingCapacity || null,
            jet_count: row.jetCount || null,
            water_capacity_gallons: row.waterCapacityGallons || null,
            dimensions_length_inches: row.dimensionsLengthInches || null,
            dimensions_width_inches: row.dimensionsWidthInches || null,
            dimensions_height_inches: row.dimensionsHeightInches || null,
            weight_dry_lbs: row.weightDryLbs || null,
            weight_filled_lbs: row.weightFilledLbs || null,
            image_url: row.imageUrl || null,
            spec_sheet_url: row.specSheetUrl || null,
            notes: row.notes || null,
            is_discontinued: row.isDiscontinued ?? false,
            data_source: row.dataSource || 'csv_import',
          })
          .returning('*');

        await logAudit(
          'scdb_spa_models',
          inserted.id,
          'INSERT' as AuditAction,
          null,
          inserted,
          userId
        );

        let qualifierValues = parseQualifierValuesFromRow(row as Record<string, unknown>, qualifierNameToId);
        if (Object.keys(qualifierValues).length > 0) {
          const brandQualifierIds = new Set(await qdbService.getBrandQualifiers(brand.id));
          qualifierValues = filterQualifierValuesForBrand(
            qualifierValues,
            brand.id,
            qualifierIdToQualifier,
            brandQualifierIds
          );
          if (Object.keys(qualifierValues).length > 0) {
            await qdbService.setSpaQualifiersBatch(inserted.id, qualifierValues, userId);
          }
        }

        created++;
      } catch (err: any) {
        errors.push(`Row ${rowNum} "${row.name}": ${err.message}`);
      }
    }

    const autoCreatedMsg = [];
    if (brandsAutoCreated > 0) autoCreatedMsg.push(`${brandsAutoCreated} brands`);
    if (modelLinesAutoCreated > 0) autoCreatedMsg.push(`${modelLinesAutoCreated} model lines`);
    
    success(
      res, 
      { created, skipped, brandsAutoCreated, modelLinesAutoCreated, errors }, 
      `Imported ${created} spa models${autoCreatedMsg.length > 0 ? ` (auto-created ${autoCreatedMsg.join(', ')})` : ''}`
    );
  } catch (err) {
    console.error('Error importing spas:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to import spas', 500);
  }
}

export async function importParts(req: Request, res: Response) {
  try {
    const { rows, autoCreate } = req.body as { rows: PartImportRow[]; autoCreate?: boolean };
    const userId = (req as any).superAdminEmail;

    if (!rows || !Array.isArray(rows)) {
      return error(res, 'VALIDATION_ERROR', 'Rows array is required', 400);
    }

    let created = 0;
    let skipped = 0;
    let updated = 0;
    let compatibilityCreated = 0;
    let categoriesAutoCreated = 0;
    let brandsAutoCreated = 0;
    let modelLinesAutoCreated = 0;
    let spasAutoCreated = 0;
    const errors: string[] = [];

    // Track current part for continuation rows
    let currentPart: { id: string; name: string; isUniversal: boolean } | null = null;

    // Helper to slugify category name for internal name
    function slugifyCategory(name: string): string {
      return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    }

    // Helper to get or create category
    async function getOrCreateCategory(categoryName: string): Promise<any> {
      let category = await db('pcdb_categories')
        .where('name', 'ilike', categoryName)
        .orWhere('display_name', 'ilike', categoryName)
        .first();
      
      if (!category && autoCreate) {
        const slugName = slugifyCategory(categoryName);
        const [newCategory] = await db('pcdb_categories')
          .insert({
            name: slugName,
            display_name: categoryName,
            sort_order: 99,
          })
          .returning('*');
        await logAudit('pcdb_categories', newCategory.id, 'INSERT' as AuditAction, null, newCategory, userId);
        category = newCategory;
        categoriesAutoCreated++;
      }
      return category;
    }

    // Helper to get or create brand
    async function getOrCreateBrand(brandName: string): Promise<any> {
      let brand = await db('scdb_brands').where('name', 'ilike', brandName).first();
      if (!brand && autoCreate) {
        const [newBrand] = await db('scdb_brands')
          .insert({
            name: brandName,
            data_source: 'auto_created_during_import',
          })
          .returning('*');
        await logAudit('scdb_brands', newBrand.id, 'INSERT' as AuditAction, null, newBrand, userId);
        brand = newBrand;
        brandsAutoCreated++;
      }
      return brand;
    }

    // Helper to get or create model line
    async function getOrCreateModelLine(brandId: string, brandName: string, modelLineName: string): Promise<any> {
      let modelLine = await db('scdb_model_lines')
        .where('brand_id', brandId)
        .where('name', 'ilike', modelLineName)
        .first();
      if (!modelLine && autoCreate) {
        const [newModelLine] = await db('scdb_model_lines')
          .insert({
            brand_id: brandId,
            name: modelLineName,
            data_source: 'auto_created_during_import',
          })
          .returning('*');
        await logAudit('scdb_model_lines', newModelLine.id, 'INSERT' as AuditAction, null, newModelLine, userId);
        modelLine = newModelLine;
        modelLinesAutoCreated++;
      }
      return modelLine;
    }

    // Helper to get or create spa
    async function getOrCreateSpa(brandId: string, modelLineId: string, spaName: string, year: number): Promise<any> {
      let spa = await db('scdb_spa_models')
        .where('model_line_id', modelLineId)
        .where('name', 'ilike', spaName)
        .where('year', year)
        .whereNull('deleted_at')
        .first();
      if (!spa && autoCreate) {
        const [newSpa] = await db('scdb_spa_models')
          .insert({
            brand_id: brandId,
            model_line_id: modelLineId,
            name: spaName,
            year: year,
            data_source: 'auto_created_during_import',
          })
          .returning('*');
        await logAudit('scdb_spa_models', newSpa.id, 'INSERT' as AuditAction, null, newSpa, userId);
        spa = newSpa;
        spasAutoCreated++;
      }
      return spa;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      
      try {
        // Check if this is a part row or continuation row
        const hasPartInfo = row.name && row.categoryName;
        const hasCompatibility = row.compatibleBrands || row.compatibleModelLines || row.compatibleSpas || row.compatibleYears;
        
        // If no part info and no compatibility, skip
        if (!hasPartInfo && !hasCompatibility) {
          skipped++;
          continue;
        }

        // If this is a continuation row (no part info, but has compatibility)
        if (!hasPartInfo && hasCompatibility) {
          if (!currentPart) {
            errors.push(`Row ${rowNum}: Compatibility data found but no part context. Add part info (name, categoryName) first.`);
            skipped++;
            continue;
          }
          // Use the current part for compatibility
        } else if (hasPartInfo) {
          // This is a new part row - create or find the part
          const category = await getOrCreateCategory(row.categoryName!);

          if (!category) {
            errors.push(`Row ${rowNum} "${row.name}": Category "${row.categoryName}" not found. Enable auto-create to create it automatically.`);
            skipped++;
            continue;
          }

          // Check for existing part by partNumber (for duplicate handling)
          let existingPart = null;
          if (row.partNumber) {
            existingPart = await db('pcdb_parts')
              .where('part_number', row.partNumber)
              .whereNull('deleted_at')
              .first();
          }

          if (existingPart) {
            // Part already exists - use it for compatibility, don't create new
            currentPart = {
              id: existingPart.id,
              name: existingPart.name,
              isUniversal: existingPart.is_universal,
            };
            updated++;
          } else {
            // Create new part
            let skuAliasesArray: string[] | null = null;
            if (row.skuAliases) {
              skuAliasesArray = row.skuAliases.split(',').map(s => s.trim()).filter(Boolean);
            }

            const [inserted] = await db('pcdb_parts')
              .insert({
                category_id: category.id,
                name: row.name,
                part_number: row.partNumber || null,
                manufacturer_sku: row.manufacturerSku || null,
                upc: row.upc || null,
                ean: row.ean || null,
                sku_aliases: skuAliasesArray,
                manufacturer: row.manufacturer || null,
                is_oem: row.isOem ?? false,
                is_universal: row.isUniversal ?? false,
                is_discontinued: row.isDiscontinued ?? false,
                display_importance: row.displayImportance ?? 2,
                image_url: row.imageUrl || null,
                spec_sheet_url: row.specSheetUrl || null,
                notes: row.notes || null,
                data_source: row.dataSource || 'csv_import',
              })
              .returning('*');

            await logAudit(
              'pcdb_parts',
              inserted.id,
              'INSERT' as AuditAction,
              null,
              inserted,
              userId
            );

            currentPart = {
              id: inserted.id,
              name: inserted.name,
              isUniversal: inserted.is_universal,
            };
            created++;
          }
        }

        // Now handle compatibility (for both new parts and continuation rows)
        if (!currentPart) {
          continue;
        }

        // Skip compatibility if part is universal
        if (currentPart.isUniversal) {
          continue;
        }

        // Skip if no compatibility columns filled
        if (!hasCompatibility) {
          continue;
        }

        // Parse years from compatibleYears column
        const years = parseYearRange(row.compatibleYears || '');

        // Build spa query with cascading filters
        const spaIds: string[] = [];

        // Parse filter values
        const brandNames = row.compatibleBrands 
          ? row.compatibleBrands.split(',').map(s => s.trim()).filter(Boolean) 
          : [];
        const modelLineNames = row.compatibleModelLines 
          ? row.compatibleModelLines.split(',').map(s => s.trim()).filter(Boolean) 
          : [];
        const spaNames = row.compatibleSpas 
          ? row.compatibleSpas.split(',').map(s => s.trim()).filter(Boolean) 
          : [];

        // Only proceed if at least one filter is specified
        if (brandNames.length === 0 && modelLineNames.length === 0 && spaNames.length === 0 && years.length === 0) {
          continue;
        }

        // If autoCreate is enabled and we have specific spa details, create missing entities
        if (autoCreate && spaNames.length > 0 && modelLineNames.length > 0 && brandNames.length > 0 && years.length > 0) {
          // Create brands/model lines/spas if they don't exist
          for (const brandName of brandNames) {
            const brand = await getOrCreateBrand(brandName);
            if (!brand) continue;

            for (const modelLineName of modelLineNames) {
              const modelLine = await getOrCreateModelLine(brand.id, brandName, modelLineName);
              if (!modelLine) continue;

              for (const spaName of spaNames) {
                for (const year of years) {
                  const spa = await getOrCreateSpa(brand.id, modelLine.id, spaName, year);
                  if (spa && !spaIds.includes(spa.id)) {
                    spaIds.push(spa.id);
                  }
                }
              }
            }
          }
        } else {
          // Standard query-based matching
          let query = db('scdb_spa_models as sm')
            .select('sm.id')
            .leftJoin('scdb_model_lines as ml', 'sm.model_line_id', 'ml.id')
            .leftJoin('scdb_brands as b', 'sm.brand_id', 'b.id')
            .whereNull('sm.deleted_at');

          // Filter by brands if specified (case-insensitive)
          if (brandNames.length > 0) {
            const lowerBrands = brandNames.map(n => n.toLowerCase());
            query = query.whereRaw(
              `LOWER(b.name) IN (${lowerBrands.map(() => '?').join(',')})`,
              lowerBrands
            );
          }

          // Filter by model lines if specified (case-insensitive)
          if (modelLineNames.length > 0) {
            const lowerModelLines = modelLineNames.map(n => n.toLowerCase());
            query = query.whereRaw(
              `LOWER(ml.name) IN (${lowerModelLines.map(() => '?').join(',')})`,
              lowerModelLines
            );
          }

          // Filter by spa names if specified (case-insensitive)
          if (spaNames.length > 0) {
            const lowerSpaNames = spaNames.map(n => n.toLowerCase());
            query = query.whereRaw(
              `LOWER(sm.name) IN (${lowerSpaNames.map(() => '?').join(',')})`,
              lowerSpaNames
            );
          }

          // Filter by years if specified
          if (years.length > 0) {
            query = query.whereIn('sm.year', years);
          }

          const matchingSpas = await query;

          for (const spa of matchingSpas) {
            if (!spaIds.includes(spa.id)) {
              spaIds.push(spa.id);
            }
          }
        }

        // Create compatibility records
        for (const spaId of spaIds) {
          const existing = await db('part_spa_compatibility')
            .where({ part_id: currentPart.id, spa_model_id: spaId })
            .first();

          if (!existing) {
            await db('part_spa_compatibility')
              .insert({
                part_id: currentPart.id,
                spa_model_id: spaId,
                status: 'pending',
                source: 'bulk_import',
                data_source: row.dataSource || 'csv_import',
              });
            compatibilityCreated++;
          }
        }
      } catch (err: any) {
        errors.push(`Row ${rowNum} "${row.name || '(continuation)'}": ${err.message}`);
      }
    }

    const autoCreatedMsg = [];
    if (categoriesAutoCreated > 0) autoCreatedMsg.push(`${categoriesAutoCreated} categories`);
    if (brandsAutoCreated > 0) autoCreatedMsg.push(`${brandsAutoCreated} brands`);
    if (modelLinesAutoCreated > 0) autoCreatedMsg.push(`${modelLinesAutoCreated} model lines`);
    if (spasAutoCreated > 0) autoCreatedMsg.push(`${spasAutoCreated} spas`);

    success(
      res, 
      { created, updated, skipped, compatibilityCreated, categoriesAutoCreated, brandsAutoCreated, modelLinesAutoCreated, spasAutoCreated, errors }, 
      `Imported ${created} parts (${updated} existing updated) with ${compatibilityCreated} compatibility records${autoCreatedMsg.length > 0 ? ` (auto-created ${autoCreatedMsg.join(', ')})` : ''}`
    );
  } catch (err) {
    console.error('Error importing parts:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to import parts', 500);
  }
}

export async function importCompatibility(req: Request, res: Response) {
  try {
    const { rows } = req.body as { rows: CompatibilityImportRow[] };
    const userId = (req as any).superAdminEmail;

    if (!rows || !Array.isArray(rows)) {
      return error(res, 'VALIDATION_ERROR', 'Rows array is required', 400);
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is headers, data starts at row 2
      
      try {
        // Validate: Check for conflicting methods
        const hasSpaDetails = row.brandName || row.modelLineName || row.spaName || row.spaYear;
        const hasCompId = row.compId;
        
        if (hasCompId && hasSpaDetails) {
          errors.push(
            `Row ${rowNum}: Cannot use both compId AND spa details (brandName/modelLineName/spaName/spaYear). ` +
            `Use ONE method only - either fill compId OR fill the spa details, not both.`
          );
          skipped++;
          continue;
        }
        
        if (!hasCompId && !hasSpaDetails) {
          errors.push(
            `Row ${rowNum}: Missing required data. You must provide either compId OR spa details ` +
            `(brandName, modelLineName, spaName, spaYear).`
          );
          skipped++;
          continue;
        }
        
        // Validate: Must have part identifier
        if (!row.partNumber && !row.partName) {
          errors.push(`Row ${rowNum}: Either partNumber or partName is required to identify the part.`);
          skipped++;
          continue;
        }

        // Find part by number or name
        let part;
        if (row.partNumber) {
          part = await db('pcdb_parts').where('part_number', row.partNumber).first();
        }
        if (!part && row.partName) {
          part = await db('pcdb_parts').where('name', 'ilike', row.partName).first();
        }

        if (!part) {
          errors.push(`Row ${rowNum}: Part "${row.partNumber || row.partName}" not found in database. Add the part first.`);
          skipped++;
          continue;
        }

        // Handle Comp ID shortcut
        if (row.compId) {
          // Validate comp exists
          const comp = await db('compatibility_groups').where('id', row.compId).first();
          if (!comp) {
            errors.push(`Row ${rowNum}: Comp ID "${row.compId}" not found in database. Create the Comp first.`);
            skipped++;
            continue;
          }
          const compSpas = await db('comp_spas as cs')
            .select('cs.spa_model_id')
            .where('cs.comp_id', row.compId);

          for (const compSpa of compSpas) {
            const existing = await db('part_spa_compatibility')
              .where({ part_id: part.id, spa_model_id: compSpa.spa_model_id })
              .first();

            if (existing) continue;

            const [inserted] = await db('part_spa_compatibility')
              .insert({
                part_id: part.id,
                spa_model_id: compSpa.spa_model_id,
                status: 'pending',
                fit_notes: row.fitNotes,
                data_source: row.dataSource || 'csv_import',
              })
              .returning('*');

            await logAudit(
              'part_spa_compatibility',
              inserted.id,
              'INSERT' as AuditAction,
              null,
              inserted,
              userId
            );

            created++;
          }
        } else {
          // Validate all spa detail fields are present
          const missingFields = [];
          if (!row.brandName) missingFields.push('brandName');
          if (!row.modelLineName) missingFields.push('modelLineName');
          if (!row.spaName) missingFields.push('spaName');
          if (!row.spaYear) missingFields.push('spaYear');
          
          if (missingFields.length > 0) {
            errors.push(
              `Row ${rowNum}: Missing required spa details: ${missingFields.join(', ')}. ` +
              `All fields (brandName, modelLineName, spaName, spaYear) are required when not using compId.`
            );
            skipped++;
            continue;
          }
          
          // Find spa by brand/model line/name/year
          // Type assertions safe here because we validated all fields exist above
          const spa = await db('scdb_spa_models as sm')
            .select('sm.id')
            .leftJoin('scdb_model_lines as ml', 'sm.model_line_id', 'ml.id')
            .leftJoin('scdb_brands as b', 'ml.brand_id', 'b.id')
            .where('b.name', 'ilike', row.brandName as string)
            .where('ml.name', 'ilike', row.modelLineName as string)
            .where('sm.name', 'ilike', row.spaName as string)
            .where('sm.year', row.spaYear as number)
            .first();

          if (!spa) {
            errors.push(
              `Row ${rowNum}: Spa "${row.brandName} ${row.modelLineName} ${row.spaName} ${row.spaYear}" not found`
            );
            skipped++;
            continue;
          }

          const existing = await db('part_spa_compatibility')
            .where({ part_id: part.id, spa_model_id: spa.id })
            .first();

          if (existing) {
            skipped++;
            continue;
          }

          const [inserted] = await db('part_spa_compatibility')
            .insert({
              part_id: part.id,
              spa_model_id: spa.id,
              status: 'pending',
              fit_notes: row.fitNotes,
              data_source: row.dataSource || 'csv_import',
            })
            .returning('*');

          await logAudit(
            'part_spa_compatibility',
            inserted.id,
            'INSERT' as AuditAction,
            null,
            inserted,
            userId
          );

          created++;
        }
      } catch (err: any) {
        errors.push(`Row: ${err.message}`);
      }
    }

    success(res, { created, skipped, errors }, `Imported ${created} compatibility records (pending)`);
  } catch (err) {
    console.error('Error importing compatibility:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to import compatibility', 500);
  }
}
