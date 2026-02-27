import { Request, Response } from 'express';
import db from '../db';
import { success, error } from '../utils/response';
import { logAudit } from '../services/audit.service';

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
  modelName: string;
  modelYear: number;
  seatCount?: number;
  jetCount?: number;
  gallonCapacity?: number;
  dimensions?: string;
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
  brandName: string;
  modelLineName: string;
  modelName: string;
  modelYear: number;
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

        await logAudit({
          tableName: 'scdb_brands',
          recordId: inserted.id,
          action: 'INSERT',
          newValues: inserted,
          changedBy: userId,
        });

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

        await logAudit({
          tableName: 'pcdb_parts',
          recordId: inserted.id,
          action: 'INSERT',
          newValues: inserted,
          changedBy: userId,
        });

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

    for (const row of rows) {
      try {
        // Find part by number or name
        let part;
        if (row.partNumber) {
          part = await db('pcdb_parts').where('part_number', row.partNumber).first();
        }
        if (!part && row.partName) {
          part = await db('pcdb_parts').where('name', 'ilike', row.partName).first();
        }

        if (!part) {
          errors.push(`Row: Part "${row.partNumber || row.partName}" not found`);
          skipped++;
          continue;
        }

        // Handle Comp ID shortcut
        if (row.compId) {
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

            await logAudit({
              tableName: 'part_spa_compatibility',
              recordId: inserted.id,
              action: 'INSERT',
              newValues: inserted,
              changedBy: userId,
            });

            created++;
          }
        } else {
          // Find spa by brand/model line/model name/year
          const spa = await db('scdb_spa_models as sm')
            .select('sm.id')
            .leftJoin('scdb_model_lines as ml', 'sm.model_line_id', 'ml.id')
            .leftJoin('scdb_brands as b', 'ml.brand_id', 'b.id')
            .where('b.name', 'ilike', row.brandName)
            .where('ml.name', 'ilike', row.modelLineName)
            .where('sm.model_name', 'ilike', row.modelName)
            .where('sm.model_year', row.modelYear)
            .first();

          if (!spa) {
            errors.push(
              `Row: Spa "${row.brandName} ${row.modelLineName} ${row.modelName} ${row.modelYear}" not found`
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

          await logAudit({
            tableName: 'part_spa_compatibility',
            recordId: inserted.id,
            action: 'INSERT',
            newValues: inserted,
            changedBy: userId,
          });

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
