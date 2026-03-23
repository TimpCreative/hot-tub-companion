/**
 * SCdb Service
 * Spa Configuration Database - Brand, ModelLine, SpaModel CRUD operations
 */

import { db } from '../config/database';
import {
  ScdbBrand,
  CreateBrandInput,
  UpdateBrandInput,
  ScdbModelLine,
  CreateModelLineInput,
  UpdateModelLineInput,
  ScdbSpaModel,
  CreateSpaModelInput,
  UpdateSpaModelInput,
  DbScdbBrand,
  DbScdbModelLine,
  DbScdbSpaModel,
  PaginationParams,
} from '../types/uhtd.types';
import { logAudit } from './audit.service';

// =============================================================================
// Utility Functions
// =============================================================================

function mapBrandFromDb(row: DbScdbBrand): ScdbBrand {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    websiteUrl: row.website_url,
    isActive: row.is_active,
    deletedAt: row.deleted_at,
    dataSource: row.data_source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapModelLineFromDb(row: DbScdbModelLine & { brand_name?: string }): ScdbModelLine {
  return {
    id: row.id,
    brandId: row.brand_id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    deletedAt: row.deleted_at,
    dataSource: row.data_source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    brandName: row.brand_name,
  };
}

function mapSpaModelFromDb(
  row: DbScdbSpaModel & { brand_name?: string; model_line_name?: string }
): ScdbSpaModel {
  return {
    id: row.id,
    modelLineId: row.model_line_id,
    brandId: row.brand_id,
    name: row.name,
    year: row.year,
    manufacturerSku: row.manufacturer_sku,
    waterCapacityGallons: row.water_capacity_gallons,
    jetCount: row.jet_count,
    seatingCapacity: row.seating_capacity,
    dimensionsLengthInches: row.dimensions_length_inches,
    dimensionsWidthInches: row.dimensions_width_inches,
    dimensionsHeightInches: row.dimensions_height_inches,
    weightDryLbs: row.weight_dry_lbs,
    weightFilledLbs: row.weight_filled_lbs,
    imageUrl: row.image_url,
    specSheetUrl: row.spec_sheet_url,
    isDiscontinued: row.is_discontinued,
    notes: row.notes,
    dataSource: row.data_source,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    brandName: row.brand_name,
    modelLineName: row.model_line_name,
  };
}

// =============================================================================
// Brands
// =============================================================================

export async function listBrands(
  includeDeleted = false,
  pagination?: PaginationParams
): Promise<{ brands: ScdbBrand[]; total: number }> {
  const baseQuery = () => {
    let q = db('scdb_brands');
    if (!includeDeleted) q = q.whereNull('deleted_at');
    return q;
  };

  // Get total count (separate query to avoid select * + count SQL error)
  const countResult = await baseQuery().count('* as count').first();
  const total = parseInt((countResult?.count as string) ?? '0', 10);

  // Build data query
  let dataQuery = baseQuery().select('*');
  const sortBy = pagination?.sortBy || 'name';
  const sortOrder = pagination?.sortOrder || 'asc';
  dataQuery = dataQuery.orderBy(sortBy, sortOrder);

  if (pagination?.page && pagination?.pageSize) {
    const offset = (pagination.page - 1) * pagination.pageSize;
    dataQuery = dataQuery.offset(offset).limit(pagination.pageSize);
  }

  const rows = await dataQuery;
  return {
    brands: rows.map(mapBrandFromDb),
    total,
  };
}

export async function getBrandById(id: string): Promise<ScdbBrand | null> {
  const row = await db('scdb_brands').where({ id }).whereNull('deleted_at').first();
  return row ? mapBrandFromDb(row) : null;
}

export async function getBrandByName(name: string): Promise<ScdbBrand | null> {
  const row = await db('scdb_brands')
    .whereRaw('LOWER(name) = LOWER(?)', [name])
    .whereNull('deleted_at')
    .first();
  return row ? mapBrandFromDb(row) : null;
}

export async function createBrand(input: CreateBrandInput, userId?: string): Promise<ScdbBrand> {
  const [row] = await db('scdb_brands')
    .insert({
      name: input.name,
      logo_url: input.logoUrl,
      website_url: input.websiteUrl,
      is_active: input.isActive ?? true,
      data_source: input.dataSource,
    })
    .returning('*');

  await logAudit('scdb_brands', row.id, 'INSERT', null, row, userId);
  return mapBrandFromDb(row);
}

export async function updateBrand(
  id: string,
  input: UpdateBrandInput,
  userId?: string
): Promise<ScdbBrand | null> {
  const oldRow = await db('scdb_brands').where({ id }).first();
  if (!oldRow || oldRow.deleted_at) return null;

  const updateData: Record<string, unknown> = { updated_at: db.fn.now() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.logoUrl !== undefined) updateData.logo_url = input.logoUrl;
  if (input.websiteUrl !== undefined) updateData.website_url = input.websiteUrl;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;
  if (input.dataSource !== undefined) updateData.data_source = input.dataSource;

  const [row] = await db('scdb_brands').where({ id }).update(updateData).returning('*');

  await logAudit('scdb_brands', row.id, 'UPDATE', oldRow, row, userId);
  return mapBrandFromDb(row);
}

export async function deleteBrand(id: string, userId?: string): Promise<boolean> {
  const oldRow = await db('scdb_brands').where({ id }).first();
  if (!oldRow || oldRow.deleted_at) return false;

  await db('scdb_brands').where({ id }).update({ deleted_at: db.fn.now() });
  await logAudit('scdb_brands', id, 'DELETE', oldRow, null, userId);
  return true;
}

// =============================================================================
// Model Lines
// =============================================================================

export async function listModelLines(
  brandId?: string,
  includeDeleted = false
): Promise<ScdbModelLine[]> {
  let query = db('scdb_model_lines')
    .select('scdb_model_lines.*', 'scdb_brands.name as brand_name')
    .leftJoin('scdb_brands', 'scdb_model_lines.brand_id', 'scdb_brands.id');

  if (brandId) {
    query = query.where('scdb_model_lines.brand_id', brandId);
  }
  if (!includeDeleted) {
    query = query.whereNull('scdb_model_lines.deleted_at');
  }

  const rows = await query.orderBy('scdb_model_lines.name');
  return rows.map(mapModelLineFromDb);
}

export async function getModelLineById(id: string): Promise<ScdbModelLine | null> {
  const row = await db('scdb_model_lines')
    .select('scdb_model_lines.*', 'scdb_brands.name as brand_name')
    .leftJoin('scdb_brands', 'scdb_model_lines.brand_id', 'scdb_brands.id')
    .where('scdb_model_lines.id', id)
    .whereNull('scdb_model_lines.deleted_at')
    .first();
  return row ? mapModelLineFromDb(row) : null;
}

export async function createModelLine(
  input: CreateModelLineInput,
  userId?: string
): Promise<ScdbModelLine> {
  const [row] = await db('scdb_model_lines')
    .insert({
      brand_id: input.brandId,
      name: input.name,
      description: input.description,
      is_active: input.isActive ?? true,
      data_source: input.dataSource,
    })
    .returning('*');

  await logAudit('scdb_model_lines', row.id, 'INSERT', null, row, userId);

  // Fetch with joins
  return (await getModelLineById(row.id))!;
}

export async function updateModelLine(
  id: string,
  input: UpdateModelLineInput,
  userId?: string
): Promise<ScdbModelLine | null> {
  const oldRow = await db('scdb_model_lines').where({ id }).first();
  if (!oldRow || oldRow.deleted_at) return null;

  const updateData: Record<string, unknown> = { updated_at: db.fn.now() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;
  if (input.dataSource !== undefined) updateData.data_source = input.dataSource;

  const [row] = await db('scdb_model_lines').where({ id }).update(updateData).returning('*');

  await logAudit('scdb_model_lines', row.id, 'UPDATE', oldRow, row, userId);
  return getModelLineById(row.id);
}

export async function deleteModelLine(id: string, userId?: string): Promise<boolean> {
  const oldRow = await db('scdb_model_lines').where({ id }).first();
  if (!oldRow || oldRow.deleted_at) return false;

  await db('scdb_model_lines').where({ id }).update({ deleted_at: db.fn.now() });
  await logAudit('scdb_model_lines', id, 'DELETE', oldRow, null, userId);
  return true;
}

// =============================================================================
// Spa Models
// =============================================================================

export async function listSpaModels(
  filters: {
    brandId?: string;
    modelLineId?: string;
    year?: number;
    search?: string;
    includeDeleted?: boolean;
  } = {},
  pagination?: PaginationParams
): Promise<{ spaModels: ScdbSpaModel[]; total: number }> {
  const baseQuery = () => {
    let q = db('scdb_spa_models')
      .leftJoin('scdb_brands', 'scdb_spa_models.brand_id', 'scdb_brands.id')
      .leftJoin('scdb_model_lines', 'scdb_spa_models.model_line_id', 'scdb_model_lines.id');
    if (filters.brandId) q = q.where('scdb_spa_models.brand_id', filters.brandId);
    if (filters.modelLineId) q = q.where('scdb_spa_models.model_line_id', filters.modelLineId);
    if (filters.year) q = q.where('scdb_spa_models.year', filters.year);
    if (filters.search) {
      q = q.where(function () {
        this.whereRaw('scdb_spa_models.name ILIKE ?', [`%${filters.search}%`])
          .orWhereRaw('scdb_brands.name ILIKE ?', [`%${filters.search}%`]);
      });
    }
    if (!filters.includeDeleted) q = q.whereNull('scdb_spa_models.deleted_at');
    return q;
  };

  const countResult = await baseQuery().count('scdb_spa_models.id as count').first();
  const total = parseInt((countResult?.count as string) ?? '0', 10);

  let query = baseQuery().select(
    'scdb_spa_models.*',
    'scdb_brands.name as brand_name',
    'scdb_model_lines.name as model_line_name'
  );

  // Apply sorting
  const sortBy = pagination?.sortBy || 'scdb_brands.name';
  const sortOrder = pagination?.sortOrder || 'asc';
  query = query.orderBy(sortBy, sortOrder).orderBy('scdb_spa_models.name').orderBy('scdb_spa_models.year', 'desc');

  // Apply pagination
  if (pagination?.page && pagination?.pageSize) {
    const offset = (pagination.page - 1) * pagination.pageSize;
    query = query.offset(offset).limit(pagination.pageSize);
  }

  const rows = await query;
  return {
    spaModels: rows.map(mapSpaModelFromDb),
    total,
  };
}

export async function getSpaModelById(id: string): Promise<ScdbSpaModel | null> {
  const row = await db('scdb_spa_models')
    .select(
      'scdb_spa_models.*',
      'scdb_brands.name as brand_name',
      'scdb_model_lines.name as model_line_name'
    )
    .leftJoin('scdb_brands', 'scdb_spa_models.brand_id', 'scdb_brands.id')
    .leftJoin('scdb_model_lines', 'scdb_spa_models.model_line_id', 'scdb_model_lines.id')
    .where('scdb_spa_models.id', id)
    .whereNull('scdb_spa_models.deleted_at')
    .first();
  return row ? mapSpaModelFromDb(row) : null;
}

export async function getDistinctYearsForBrand(brandId: string): Promise<number[]> {
  const rows = await db('scdb_spa_models')
    .distinct('year')
    .where('brand_id', brandId)
    .whereNull('deleted_at')
    .orderBy('year', 'desc');
  return rows.map((r) => r.year);
}

export async function getDistinctModelNames(modelLineId: string): Promise<string[]> {
  const rows = await db('scdb_spa_models')
    .distinct('name')
    .where('model_line_id', modelLineId)
    .whereNull('deleted_at')
    .orderBy('name');
  return rows.map((r) => r.name);
}

export async function getYearsForModel(modelLineId: string, modelName: string): Promise<number[]> {
  const rows = await db('scdb_spa_models')
    .select('year')
    .where('model_line_id', modelLineId)
    .where('name', modelName)
    .whereNull('deleted_at')
    .orderBy('year', 'desc');
  return rows.map((r) => r.year);
}

export async function createSpaModel(
  input: CreateSpaModelInput,
  userId?: string
): Promise<ScdbSpaModel> {
  const [row] = await db('scdb_spa_models')
    .insert({
      model_line_id: input.modelLineId,
      brand_id: input.brandId,
      name: input.name,
      year: input.year,
      manufacturer_sku: input.manufacturerSku,
      water_capacity_gallons: input.waterCapacityGallons,
      jet_count: input.jetCount,
      seating_capacity: input.seatingCapacity,
      dimensions_length_inches: input.dimensionsLengthInches,
      dimensions_width_inches: input.dimensionsWidthInches,
      dimensions_height_inches: input.dimensionsHeightInches,
      weight_dry_lbs: input.weightDryLbs,
      weight_filled_lbs: input.weightFilledLbs,
      image_url: input.imageUrl,
      spec_sheet_url: input.specSheetUrl,
      is_discontinued: input.isDiscontinued ?? false,
      notes: input.notes,
      data_source: input.dataSource,
    })
    .returning('*');

  await logAudit('scdb_spa_models', row.id, 'INSERT', null, row, userId);

  return (await getSpaModelById(row.id))!;
}

export async function createSpaModelsForYears(
  baseInput: Omit<CreateSpaModelInput, 'year'>,
  years: number[],
  userId?: string
): Promise<{ created: ScdbSpaModel[]; skipped: { year: number; reason: string }[] }> {
  const created: ScdbSpaModel[] = [];
  const skipped: { year: number; reason: string }[] = [];

  for (const year of years) {
    try {
      const spaModel = await createSpaModel({ ...baseInput, year }, userId);
      created.push(spaModel);
    } catch (err: any) {
      if (err.code === '23505') {
        skipped.push({ year, reason: 'Already exists' });
      } else {
        skipped.push({ year, reason: err.message || 'Unknown error' });
      }
    }
  }

  return { created, skipped };
}

export async function updateSpaModel(
  id: string,
  input: UpdateSpaModelInput,
  userId?: string
): Promise<ScdbSpaModel | null> {
  const oldRow = await db('scdb_spa_models').where({ id }).first();
  if (!oldRow || oldRow.deleted_at) return null;

  const updateData: Record<string, unknown> = { updated_at: db.fn.now() };

  // Map all possible fields
  const fieldMappings: Record<string, string> = {
    modelLineId: 'model_line_id',
    brandId: 'brand_id',
    name: 'name',
    year: 'year',
    manufacturerSku: 'manufacturer_sku',
    waterCapacityGallons: 'water_capacity_gallons',
    jetCount: 'jet_count',
    seatingCapacity: 'seating_capacity',
    dimensionsLengthInches: 'dimensions_length_inches',
    dimensionsWidthInches: 'dimensions_width_inches',
    dimensionsHeightInches: 'dimensions_height_inches',
    weightDryLbs: 'weight_dry_lbs',
    weightFilledLbs: 'weight_filled_lbs',
    imageUrl: 'image_url',
    specSheetUrl: 'spec_sheet_url',
    isDiscontinued: 'is_discontinued',
    notes: 'notes',
    dataSource: 'data_source',
  };

  for (const [camelKey, snakeKey] of Object.entries(fieldMappings)) {
    if ((input as Record<string, unknown>)[camelKey] !== undefined) {
      updateData[snakeKey] = (input as Record<string, unknown>)[camelKey];
    }
  }

  const [row] = await db('scdb_spa_models').where({ id }).update(updateData).returning('*');

  await logAudit('scdb_spa_models', row.id, 'UPDATE', oldRow, row, userId);
  return getSpaModelById(row.id);
}

export async function deleteSpaModel(id: string, userId?: string): Promise<boolean> {
  const oldRow = await db('scdb_spa_models').where({ id }).first();
  if (!oldRow || oldRow.deleted_at) return false;

  await db('scdb_spa_models').where({ id }).update({ deleted_at: db.fn.now() });
  await logAudit('scdb_spa_models', id, 'DELETE', oldRow, null, userId);
  return true;
}

// =============================================================================
// Search
// =============================================================================

export async function searchSpaModels(
  query: string,
  limit = 50,
  brandId?: string
): Promise<ScdbSpaModel[]> {
  let q = db('scdb_spa_models')
    .select(
      'scdb_spa_models.*',
      'scdb_brands.name as brand_name',
      'scdb_model_lines.name as model_line_name'
    )
    .leftJoin('scdb_brands', 'scdb_spa_models.brand_id', 'scdb_brands.id')
    .leftJoin('scdb_model_lines', 'scdb_spa_models.model_line_id', 'scdb_model_lines.id')
    .whereNull('scdb_spa_models.deleted_at')
    .where(function () {
      this.whereRaw('scdb_spa_models.name ILIKE ?', [`%${query}%`])
        .orWhereRaw('scdb_brands.name ILIKE ?', [`%${query}%`])
        .orWhereRaw("CONCAT(scdb_brands.name, ' ', scdb_spa_models.name, ' ', scdb_spa_models.year) ILIKE ?", [`%${query}%`]);
    });

  if (brandId) {
    q = q.where('scdb_spa_models.brand_id', brandId);
  }

  const rows = await q
    .orderBy('scdb_brands.name')
    .orderBy('scdb_spa_models.name')
    .orderBy('scdb_spa_models.year', 'desc')
    .limit(limit);

  return rows.map(mapSpaModelFromDb);
}

// =============================================================================
// Public API (for mobile app spa registration)
// =============================================================================

export async function getActiveBrands(tenantId?: string): Promise<ScdbBrand[]> {
  let query = db('scdb_brands')
    .select('scdb_brands.*')
    .where('scdb_brands.is_active', true)
    .whereNull('scdb_brands.deleted_at');

  // Filter by tenant visibility if tenantId provided
  if (tenantId) {
    query = query
      .leftJoin('tenant_brand_visibility', function () {
        this.on('scdb_brands.id', '=', 'tenant_brand_visibility.brand_id').andOn(
          'tenant_brand_visibility.tenant_id',
          '=',
          db.raw('?', [tenantId])
        );
      })
      .where(function () {
        // Show brand if no visibility record exists OR is_visible is true
        this.whereNull('tenant_brand_visibility.brand_id').orWhere(
          'tenant_brand_visibility.is_visible',
          true
        );
      });
  }

  const rows = await query.orderBy('scdb_brands.name');
  return rows.map(mapBrandFromDb);
}

