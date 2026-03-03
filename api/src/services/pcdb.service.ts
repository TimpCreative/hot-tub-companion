/**
 * PCdb Service
 * Parts Catalog Database - Category, InterchangeGroup, Part CRUD operations
 */

import { db } from '../config/database';
import {
  PcdbCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
  PcdbInterchangeGroup,
  CreateInterchangeGroupInput,
  PcdbPart,
  CreatePartInput,
  UpdatePartInput,
  DbPcdbPart,
  PaginationParams,
} from '../types/uhtd.types';
import { logAudit } from './audit.service';

// =============================================================================
// Utility Functions
// =============================================================================

function mapCategoryFromDb(row: any): PcdbCategory {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    iconName: row.icon_name,
    sortOrder: row.sort_order,
    parentId: row.parent_id,
    fullPath: row.full_path,
    depth: row.depth ?? 0,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
  };
}

function mapInterchangeGroupFromDb(row: any): PcdbInterchangeGroup {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    createdAt: row.created_at,
    partCount: row.part_count ? parseInt(row.part_count, 10) : undefined,
  };
}

function mapPartFromDb(row: DbPcdbPart & { 
  category_name?: string; 
  category_display_name?: string;
  interchange_group_name?: string;
}): PcdbPart {
  return {
    id: row.id,
    categoryId: row.category_id,
    partNumber: row.part_number,
    manufacturerSku: row.manufacturer_sku,
    upc: row.upc,
    ean: row.ean,
    skuAliases: row.sku_aliases,
    name: row.name,
    manufacturer: row.manufacturer,
    interchangeGroupId: row.interchange_group_id,
    isOem: row.is_oem,
    isUniversal: row.is_universal,
    isDiscontinued: row.is_discontinued,
    discontinuedAt: row.discontinued_at,
    displayImportance: row.display_importance,
    dimensionsJson: row.dimensions_json,
    imageUrl: row.image_url,
    specSheetUrl: row.spec_sheet_url,
    notes: row.notes,
    dataSource: row.data_source,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    categoryName: row.category_name,
    categoryDisplayName: row.category_display_name,
    interchangeGroupName: row.interchange_group_name,
  };
}

// =============================================================================
// Categories
// =============================================================================

export async function listCategories(includeDeleted = false): Promise<PcdbCategory[]> {
  let query = db('pcdb_categories').select('*');
  if (!includeDeleted) {
    query = query.whereNull('deleted_at');
  }
  const rows = await query.orderBy('sort_order');
  return rows.map(mapCategoryFromDb);
}

export async function getCategoryById(id: string): Promise<PcdbCategory | null> {
  const row = await db('pcdb_categories').where({ id }).whereNull('deleted_at').first();
  return row ? mapCategoryFromDb(row) : null;
}

export async function getCategoryByName(name: string): Promise<PcdbCategory | null> {
  const row = await db('pcdb_categories')
    .whereRaw('LOWER(name) = LOWER(?)', [name])
    .whereNull('deleted_at')
    .first();
  return row ? mapCategoryFromDb(row) : null;
}

export async function createCategory(input: CreateCategoryInput, userId?: string): Promise<PcdbCategory> {
  let fullPath = `/${input.name}`;
  let depth = 0;

  if (input.parentId) {
    const parent = await getCategoryById(input.parentId);
    if (parent) {
      fullPath = `${parent.fullPath || '/' + parent.name}/${input.name}`;
      depth = (parent.depth ?? 0) + 1;
    }
  }

  const [row] = await db('pcdb_categories')
    .insert({
      name: input.name,
      display_name: input.displayName,
      description: input.description,
      icon_name: input.iconName,
      sort_order: input.sortOrder ?? 0,
      parent_id: input.parentId || null,
      full_path: fullPath,
      depth,
    })
    .returning('*');

  await logAudit('pcdb_categories', row.id, 'INSERT', null, row, userId);
  return mapCategoryFromDb(row);
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  userId?: string
): Promise<PcdbCategory | null> {
  const oldRow = await db('pcdb_categories').where({ id }).first();
  if (!oldRow || oldRow.deleted_at) return null;

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.displayName !== undefined) updateData.display_name = input.displayName;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.iconName !== undefined) updateData.icon_name = input.iconName;
  if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
  if ((input as any).parentId !== undefined) updateData.parent_id = (input as any).parentId;

  const [row] = await db('pcdb_categories').where({ id }).update(updateData).returning('*');

  await logAudit('pcdb_categories', row.id, 'UPDATE', oldRow, row, userId);
  return mapCategoryFromDb(row);
}

export async function deleteCategory(id: string, userId?: string): Promise<boolean> {
  const oldRow = await db('pcdb_categories').where({ id }).first();
  if (!oldRow || oldRow.deleted_at) return false;

  await db('pcdb_categories').where({ id }).update({ deleted_at: db.fn.now() });
  await logAudit('pcdb_categories', id, 'DELETE', oldRow, null, userId);
  return true;
}

export async function listCategoriesTree(includeDeleted = false): Promise<PcdbCategory[]> {
  let query = db('pcdb_categories').select('*');
  if (!includeDeleted) {
    query = query.whereNull('deleted_at');
  }
  const rows = await query.orderBy('depth').orderBy('sort_order');
  const allCategories = rows.map(mapCategoryFromDb);
  
  const categoryMap = new Map<string, PcdbCategory>();
  const rootCategories: PcdbCategory[] = [];
  
  for (const cat of allCategories) {
    cat.children = [];
    categoryMap.set(cat.id, cat);
  }
  
  for (const cat of allCategories) {
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      const parent = categoryMap.get(cat.parentId)!;
      parent.children!.push(cat);
    } else {
      rootCategories.push(cat);
    }
  }
  
  return rootCategories;
}

export async function getCategoryAncestors(id: string): Promise<PcdbCategory[]> {
  const ancestors: PcdbCategory[] = [];
  let current = await getCategoryById(id);
  
  while (current && current.parentId) {
    const parent = await getCategoryById(current.parentId);
    if (parent) {
      ancestors.unshift(parent);
      current = parent;
    } else {
      break;
    }
  }
  
  return ancestors;
}

// =============================================================================
// Interchange Groups
// =============================================================================

export async function listInterchangeGroups(): Promise<PcdbInterchangeGroup[]> {
  const rows = await db('pcdb_interchange_groups')
    .select('pcdb_interchange_groups.*')
    .count('pcdb_parts.id as part_count')
    .leftJoin('pcdb_parts', 'pcdb_interchange_groups.id', 'pcdb_parts.interchange_group_id')
    .groupBy('pcdb_interchange_groups.id')
    .orderBy('pcdb_interchange_groups.name');
  return rows.map(mapInterchangeGroupFromDb);
}

export async function getInterchangeGroupById(id: string): Promise<PcdbInterchangeGroup | null> {
  const [row] = await db('pcdb_interchange_groups')
    .select('pcdb_interchange_groups.*')
    .count('pcdb_parts.id as part_count')
    .leftJoin('pcdb_parts', 'pcdb_interchange_groups.id', 'pcdb_parts.interchange_group_id')
    .where('pcdb_interchange_groups.id', id)
    .groupBy('pcdb_interchange_groups.id');
  return row ? mapInterchangeGroupFromDb(row) : null;
}

export async function getPartsInInterchangeGroup(groupId: string): Promise<PcdbPart[]> {
  const rows = await db('pcdb_parts')
    .select(
      'pcdb_parts.*',
      'pcdb_categories.name as category_name',
      'pcdb_categories.display_name as category_display_name'
    )
    .leftJoin('pcdb_categories', 'pcdb_parts.category_id', 'pcdb_categories.id')
    .where('pcdb_parts.interchange_group_id', groupId)
    .whereNull('pcdb_parts.deleted_at')
    .orderBy('pcdb_parts.display_importance')
    .orderBy('pcdb_parts.name');
  return rows.map(mapPartFromDb);
}

export async function createInterchangeGroup(
  input: CreateInterchangeGroupInput,
  userId?: string
): Promise<PcdbInterchangeGroup> {
  const [row] = await db('pcdb_interchange_groups')
    .insert({
      name: input.name,
      notes: input.notes,
    })
    .returning('*');

  await logAudit('pcdb_interchange_groups', row.id, 'INSERT', null, row, userId);
  return mapInterchangeGroupFromDb(row);
}

export async function updateInterchangeGroup(
  id: string,
  input: CreateInterchangeGroupInput,
  userId?: string
): Promise<PcdbInterchangeGroup | null> {
  const oldRow = await db('pcdb_interchange_groups').where({ id }).first();
  if (!oldRow) return null;

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const [row] = await db('pcdb_interchange_groups').where({ id }).update(updateData).returning('*');

  await logAudit('pcdb_interchange_groups', row.id, 'UPDATE', oldRow, row, userId);
  return getInterchangeGroupById(row.id);
}

export async function deleteInterchangeGroup(id: string, userId?: string): Promise<boolean> {
  const oldRow = await db('pcdb_interchange_groups').where({ id }).first();
  if (!oldRow) return false;

  // Clear interchange_group_id from all parts first
  await db('pcdb_parts').where({ interchange_group_id: id }).update({ interchange_group_id: null });

  await db('pcdb_interchange_groups').where({ id }).del();
  await logAudit('pcdb_interchange_groups', id, 'DELETE', oldRow, null, userId);
  return true;
}

// =============================================================================
// Parts
// =============================================================================

export async function listParts(
  filters: {
    categoryId?: string;
    manufacturer?: string;
    isOem?: boolean;
    isUniversal?: boolean;
    search?: string;
    includeDeleted?: boolean;
  } = {},
  pagination?: PaginationParams
): Promise<{ parts: PcdbPart[]; total: number }> {
  const baseQuery = () => {
    let q = db('pcdb_parts')
      .leftJoin('pcdb_categories', 'pcdb_parts.category_id', 'pcdb_categories.id')
      .leftJoin('pcdb_interchange_groups', 'pcdb_parts.interchange_group_id', 'pcdb_interchange_groups.id');
    if (filters.categoryId) q = q.where('pcdb_parts.category_id', filters.categoryId);
    if (filters.manufacturer) q = q.whereRaw('LOWER(pcdb_parts.manufacturer) = LOWER(?)', [filters.manufacturer]);
    if (filters.isOem !== undefined) q = q.where('pcdb_parts.is_oem', filters.isOem);
    if (filters.isUniversal !== undefined) q = q.where('pcdb_parts.is_universal', filters.isUniversal);
    if (filters.search) {
      q = q.where(function () {
        this.whereRaw('pcdb_parts.name ILIKE ?', [`%${filters.search}%`])
          .orWhereRaw('pcdb_parts.part_number ILIKE ?', [`%${filters.search}%`])
          .orWhereRaw('pcdb_parts.manufacturer ILIKE ?', [`%${filters.search}%`]);
      });
    }
    if (!filters.includeDeleted) q = q.whereNull('pcdb_parts.deleted_at');
    return q;
  };

  const countResult = await baseQuery().count('pcdb_parts.id as count').first();
  const total = parseInt((countResult?.count as string) ?? '0', 10);

  let dataQuery = baseQuery().select(
    'pcdb_parts.*',
    'pcdb_categories.name as category_name',
    'pcdb_categories.display_name as category_display_name',
    'pcdb_interchange_groups.name as interchange_group_name'
  );
  const sortBy = pagination?.sortBy || 'pcdb_parts.name';
  const sortOrder = pagination?.sortOrder || 'asc';
  dataQuery = dataQuery.orderBy('pcdb_parts.display_importance').orderBy(sortBy, sortOrder);

  if (pagination?.page && pagination?.pageSize) {
    const offset = (pagination.page - 1) * pagination.pageSize;
    dataQuery = dataQuery.offset(offset).limit(pagination.pageSize);
  }

  const rows = await dataQuery;
  return {
    parts: rows.map(mapPartFromDb),
    total,
  };
}

export async function getPartById(id: string): Promise<PcdbPart | null> {
  const row = await db('pcdb_parts')
    .select(
      'pcdb_parts.*',
      'pcdb_categories.name as category_name',
      'pcdb_categories.display_name as category_display_name',
      'pcdb_interchange_groups.name as interchange_group_name'
    )
    .leftJoin('pcdb_categories', 'pcdb_parts.category_id', 'pcdb_categories.id')
    .leftJoin('pcdb_interchange_groups', 'pcdb_parts.interchange_group_id', 'pcdb_interchange_groups.id')
    .where('pcdb_parts.id', id)
    .whereNull('pcdb_parts.deleted_at')
    .first();
  return row ? mapPartFromDb(row) : null;
}

export async function getPartByUpc(upc: string): Promise<PcdbPart | null> {
  const row = await db('pcdb_parts')
    .select('pcdb_parts.*')
    .where('pcdb_parts.upc', upc)
    .whereNull('pcdb_parts.deleted_at')
    .first();
  return row ? mapPartFromDb(row) : null;
}

export async function getPartByPartNumber(partNumber: string): Promise<PcdbPart | null> {
  const row = await db('pcdb_parts')
    .select('pcdb_parts.*')
    .whereRaw('LOWER(pcdb_parts.part_number) = LOWER(?)', [partNumber])
    .whereNull('pcdb_parts.deleted_at')
    .first();
  return row ? mapPartFromDb(row) : null;
}

export async function createPart(input: CreatePartInput, userId?: string): Promise<PcdbPart> {
  const insertData: Record<string, unknown> = {
      category_id: input.categoryId,
      part_number: input.partNumber ?? null,
      manufacturer_sku: input.manufacturerSku ?? null,
      upc: input.upc ?? null,
      ean: input.ean ?? null,
      sku_aliases: input.skuAliases,
      name: input.name,
      manufacturer: input.manufacturer ?? null,
      is_oem: input.isOem ?? false,
      is_universal: input.isUniversal ?? false,
      is_discontinued: input.isDiscontinued ?? false,
      display_importance: input.displayImportance ?? 2,
      dimensions_json: input.dimensionsJson ? JSON.stringify(input.dimensionsJson) : null,
      image_url: input.imageUrl ?? null,
      spec_sheet_url: input.specSheetUrl ?? null,
      notes: input.notes ?? null,
      data_source: input.dataSource ?? null,
    };
  const interchangeGroupId = input.interchangeGroupId && String(input.interchangeGroupId).trim();
  if (interchangeGroupId) {
    insertData.interchange_group_id = interchangeGroupId;
  }
  const [row] = await db('pcdb_parts')
    .insert(insertData)
    .returning('*');

  await logAudit('pcdb_parts', row.id, 'INSERT', null, row, userId);
  return (await getPartById(row.id))!;
}

export async function updatePart(
  id: string,
  input: UpdatePartInput,
  userId?: string
): Promise<PcdbPart | null> {
  const oldRow = await db('pcdb_parts').where({ id }).first();
  if (!oldRow || oldRow.deleted_at) return null;

  const updateData: Record<string, unknown> = { updated_at: db.fn.now() };

  const fieldMappings: Record<string, string> = {
    categoryId: 'category_id',
    partNumber: 'part_number',
    manufacturerSku: 'manufacturer_sku',
    upc: 'upc',
    ean: 'ean',
    skuAliases: 'sku_aliases',
    name: 'name',
    manufacturer: 'manufacturer',
    interchangeGroupId: 'interchange_group_id',
    isOem: 'is_oem',
    isUniversal: 'is_universal',
    isDiscontinued: 'is_discontinued',
    displayImportance: 'display_importance',
    dimensionsJson: 'dimensions_json',
    imageUrl: 'image_url',
    specSheetUrl: 'spec_sheet_url',
    notes: 'notes',
    dataSource: 'data_source',
  };

  for (const [camelKey, snakeKey] of Object.entries(fieldMappings)) {
    const value = (input as Record<string, unknown>)[camelKey];
    if (value !== undefined) {
      if (camelKey === 'dimensionsJson' && value) {
        updateData[snakeKey] = JSON.stringify(value);
      } else if (camelKey === 'interchangeGroupId') {
        updateData[snakeKey] = value && String(value).trim() ? value : null;
      } else {
        updateData[snakeKey] = value;
      }
    }
  }

  const [row] = await db('pcdb_parts').where({ id }).update(updateData).returning('*');

  await logAudit('pcdb_parts', row.id, 'UPDATE', oldRow, row, userId);
  return getPartById(row.id);
}

export async function deletePart(id: string, userId?: string): Promise<boolean> {
  const oldRow = await db('pcdb_parts').where({ id }).first();
  if (!oldRow || oldRow.deleted_at) return false;

  await db('pcdb_parts').where({ id }).update({ deleted_at: db.fn.now() });
  await logAudit('pcdb_parts', id, 'DELETE', oldRow, null, userId);
  return true;
}

// =============================================================================
// Search
// =============================================================================

export async function searchParts(query: string, limit = 50): Promise<PcdbPart[]> {
  const rows = await db('pcdb_parts')
    .select(
      'pcdb_parts.*',
      'pcdb_categories.name as category_name',
      'pcdb_categories.display_name as category_display_name'
    )
    .leftJoin('pcdb_categories', 'pcdb_parts.category_id', 'pcdb_categories.id')
    .whereNull('pcdb_parts.deleted_at')
    .where(function () {
      this.whereRaw('pcdb_parts.name ILIKE ?', [`%${query}%`])
        .orWhereRaw('pcdb_parts.part_number ILIKE ?', [`%${query}%`])
        .orWhereRaw('pcdb_parts.upc = ?', [query])
        .orWhereRaw('pcdb_parts.manufacturer ILIKE ?', [`%${query}%`]);
    })
    .orderBy('pcdb_parts.display_importance')
    .orderBy('pcdb_parts.name')
    .limit(limit);

  return rows.map(mapPartFromDb);
}

// =============================================================================
// Distinct Values
// =============================================================================

export async function getDistinctManufacturers(): Promise<string[]> {
  const rows = await db('pcdb_parts')
    .distinct('manufacturer')
    .whereNotNull('manufacturer')
    .whereNull('deleted_at')
    .orderBy('manufacturer');
  return rows.map((r) => r.manufacturer);
}

// =============================================================================
// POS Auto-Mapping Support
// =============================================================================

export async function findPartByIdentifiers(identifiers: {
  upc?: string;
  sku?: string;
  name?: string;
}): Promise<PcdbPart | null> {
  // Priority 1: UPC match (highest confidence)
  if (identifiers.upc) {
    const part = await getPartByUpc(identifiers.upc);
    if (part) return part;
  }

  // Priority 2: Part number / SKU match
  if (identifiers.sku) {
    const part = await getPartByPartNumber(identifiers.sku);
    if (part) return part;

    // Also check sku_aliases
    const aliasMatch = await db('pcdb_parts')
      .select('pcdb_parts.*')
      .whereRaw('? = ANY(pcdb_parts.sku_aliases)', [identifiers.sku])
      .whereNull('pcdb_parts.deleted_at')
      .first();
    if (aliasMatch) return mapPartFromDb(aliasMatch);
  }

  // Priority 3: Name fuzzy match (lowest confidence, would need pg_trgm)
  // Not implemented here - would return suggestions instead of auto-mapping

  return null;
}
