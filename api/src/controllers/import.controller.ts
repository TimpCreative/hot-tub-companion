import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import { logAudit } from '../services/audit.service';
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
  seatingCapacity?: number;
  jetCount?: number;
  waterCapacityGallons?: number;
  dimensionsLengthInches?: number;
  dimensionsWidthInches?: number;
  dimensionsHeightInches?: number;
  weightDryLbs?: number;
  weightFilledLbs?: number;
  electricalRequirement?: string;
  hasOzone?: boolean;
  hasUv?: boolean;
  hasSaltSystem?: boolean;
  isDiscontinued?: boolean;
  dataSource?: string;
}

interface PartImportRow {
  name: string;
  categoryName: string;
  partNumber?: string;
  upc?: string;
  manufacturer?: string;
  isOem?: boolean;
  isUniversal?: boolean;
  dataSource?: string;
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
    const { rows } = req.body as { rows: ModelLineImportRow[] };
    const userId = (req as any).superAdminEmail;

    if (!rows || !Array.isArray(rows)) {
      return error(res, 'VALIDATION_ERROR', 'Rows array is required', 400);
    }

    let created = 0;
    let skipped = 0;
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

        const brand = await db('scdb_brands').where('name', 'ilike', row.brandName).first();
        if (!brand) {
          errors.push(`Row ${rowNum}: Brand "${row.brandName}" not found. Add the brand first.`);
          skipped++;
          continue;
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

    success(res, { created, skipped, errors }, `Imported ${created} model lines`);
  } catch (err) {
    console.error('Error importing model lines:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to import model lines', 500);
  }
}

export async function importSpas(req: Request, res: Response) {
  try {
    const { rows } = req.body as { rows: SpaModelImportRow[] };
    const userId = (req as any).superAdminEmail;

    if (!rows || !Array.isArray(rows)) {
      return error(res, 'VALIDATION_ERROR', 'Rows array is required', 400);
    }

    let created = 0;
    let skipped = 0;
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

        const brand = await db('scdb_brands').where('name', 'ilike', row.brandName).first();
        if (!brand) {
          errors.push(`Row ${rowNum}: Brand "${row.brandName}" not found. Add the brand first.`);
          skipped++;
          continue;
        }

        const modelLine = await db('scdb_model_lines')
          .where('brand_id', brand.id)
          .where('name', 'ilike', row.modelLineName)
          .first();

        if (!modelLine) {
          errors.push(`Row ${rowNum}: Model Line "${row.modelLineName}" not found under brand "${row.brandName}". Add the model line first.`);
          skipped++;
          continue;
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
            seating_capacity: row.seatingCapacity || null,
            jet_count: row.jetCount || null,
            water_capacity_gallons: row.waterCapacityGallons || null,
            dimensions_length_inches: row.dimensionsLengthInches || null,
            dimensions_width_inches: row.dimensionsWidthInches || null,
            dimensions_height_inches: row.dimensionsHeightInches || null,
            weight_dry_lbs: row.weightDryLbs || null,
            weight_filled_lbs: row.weightFilledLbs || null,
            electrical_requirement: row.electricalRequirement || null,
            has_ozone: row.hasOzone ?? false,
            has_uv: row.hasUv ?? false,
            has_salt_system: row.hasSaltSystem ?? false,
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

        created++;
      } catch (err: any) {
        errors.push(`Row ${rowNum} "${row.name}": ${err.message}`);
      }
    }

    success(res, { created, skipped, errors }, `Imported ${created} spa models`);
  } catch (err) {
    console.error('Error importing spas:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to import spas', 500);
  }
}

export async function importParts(req: Request, res: Response) {
  try {
    const { rows } = req.body as { rows: PartImportRow[] };
    const userId = (req as any).superAdminEmail;

    if (!rows || !Array.isArray(rows)) {
      return error(res, 'VALIDATION_ERROR', 'Rows array is required', 400);
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        if (!row.name || !row.categoryName) {
          skipped++;
          continue;
        }

        const category = await db('pcdb_categories')
          .where('name', 'ilike', row.categoryName)
          .orWhere('display_name', 'ilike', row.categoryName)
          .first();

        if (!category) {
          errors.push(`Row "${row.name}": Category "${row.categoryName}" not found`);
          skipped++;
          continue;
        }

        const [inserted] = await db('pcdb_parts')
          .insert({
            category_id: category.id,
            name: row.name,
            part_number: row.partNumber,
            upc: row.upc,
            manufacturer: row.manufacturer,
            is_oem: row.isOem ?? false,
            is_universal: row.isUniversal ?? false,
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

        created++;
      } catch (err: any) {
        errors.push(`Row "${row.name}": ${err.message}`);
      }
    }

    success(res, { created, skipped, errors }, `Imported ${created} parts`);
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
