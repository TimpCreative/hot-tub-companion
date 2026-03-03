/**
 * PCdb Controller
 * Parts Catalog Database - API endpoint handlers
 */

import { Request, Response } from 'express';
import * as pcdbService from '../services/pcdb.service';
import { success, error } from '../utils/response';

// =============================================================================
// Categories
// =============================================================================

export async function listCategories(req: Request, res: Response) {
  try {
    const { includeDeleted, tree } = req.query;
    const categories = tree === 'true'
      ? await pcdbService.listCategoriesTree(includeDeleted === 'true')
      : await pcdbService.listCategories(includeDeleted === 'true');
    return success(res, categories);
  } catch (err) {
    console.error('Error listing categories:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list categories', 500);
  }
}

export async function getCategoryAncestors(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const ancestors = await pcdbService.getCategoryAncestors(id);
    return success(res, ancestors);
  } catch (err) {
    console.error('Error getting category ancestors:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get category ancestors', 500);
  }
}

export async function getCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const category = await pcdbService.getCategoryById(id);
    if (!category) {
      return error(res, 'NOT_FOUND', 'Category not found', 404);
    }
    return success(res, category);
  } catch (err) {
    console.error('Error getting category:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get category', 500);
  }
}

export async function createCategory(req: Request, res: Response) {
  try {
    const { name, displayName, description, iconName, sortOrder, parentId } = req.body;
    if (!name || !displayName) {
      return error(res, 'VALIDATION_ERROR', 'name and displayName are required', 400);
    }

    const existing = await pcdbService.getCategoryByName(name);
    if (existing) {
      return error(res, 'CONFLICT', 'Category with this name already exists', 409);
    }

    const userId = (req as any).superAdminEmail;
    const category = await pcdbService.createCategory(
      { name, displayName, description, iconName, sortOrder, parentId },
      userId
    );
    res.status(201);
    return success(res, category, 'Category created');
  } catch (err) {
    console.error('Error creating category:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to create category', 500);
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, displayName, description, iconName, sortOrder } = req.body;

    const userId = (req as any).superAdminEmail;
    const category = await pcdbService.updateCategory(
      id,
      { name, displayName, description, iconName, sortOrder },
      userId
    );
    if (!category) {
      return error(res, 'NOT_FOUND', 'Category not found', 404);
    }
    return success(res, category);
  } catch (err) {
    console.error('Error updating category:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update category', 500);
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).superAdminEmail;
    const deleted = await pcdbService.deleteCategory(id, userId);
    if (!deleted) {
      return error(res, 'NOT_FOUND', 'Category not found', 404);
    }
    return success(res, null, 'Category deleted');
  } catch (err) {
    console.error('Error deleting category:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to delete category', 500);
  }
}

// =============================================================================
// Interchange Groups
// =============================================================================

export async function listInterchangeGroups(req: Request, res: Response) {
  try {
    const groups = await pcdbService.listInterchangeGroups();
    return success(res, groups);
  } catch (err) {
    console.error('Error listing interchange groups:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list interchange groups', 500);
  }
}

export async function getInterchangeGroup(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const group = await pcdbService.getInterchangeGroupById(id);
    if (!group) {
      return error(res, 'NOT_FOUND', 'Interchange group not found', 404);
    }
    return success(res, group);
  } catch (err) {
    console.error('Error getting interchange group:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get interchange group', 500);
  }
}

export async function getInterchangeGroupParts(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const parts = await pcdbService.getPartsInInterchangeGroup(id);
    return success(res, parts);
  } catch (err) {
    console.error('Error getting interchange group parts:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get interchange group parts', 500);
  }
}

export async function createInterchangeGroup(req: Request, res: Response) {
  try {
    const { name, notes } = req.body;

    const userId = (req as any).superAdminEmail;
    const group = await pcdbService.createInterchangeGroup({ name, notes }, userId);
    res.status(201);
    return success(res, group, 'Interchange group created');
  } catch (err) {
    console.error('Error creating interchange group:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to create interchange group', 500);
  }
}

export async function updateInterchangeGroup(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, notes } = req.body;

    const userId = (req as any).superAdminEmail;
    const group = await pcdbService.updateInterchangeGroup(id, { name, notes }, userId);
    if (!group) {
      return error(res, 'NOT_FOUND', 'Interchange group not found', 404);
    }
    return success(res, group);
  } catch (err) {
    console.error('Error updating interchange group:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update interchange group', 500);
  }
}

export async function deleteInterchangeGroup(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).superAdminEmail;
    const deleted = await pcdbService.deleteInterchangeGroup(id, userId);
    if (!deleted) {
      return error(res, 'NOT_FOUND', 'Interchange group not found', 404);
    }
    return success(res, null, 'Interchange group deleted');
  } catch (err) {
    console.error('Error deleting interchange group:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to delete interchange group', 500);
  }
}

// =============================================================================
// Parts
// =============================================================================

export async function listParts(req: Request, res: Response) {
  try {
    const { categoryId, manufacturer, isOem, isUniversal, search, includeDeleted, page, pageSize, sortBy, sortOrder } = req.query;
    const pagination = page && pageSize
      ? {
          page: parseInt(page as string, 10),
          pageSize: parseInt(pageSize as string, 10),
          sortBy: sortBy as string,
          sortOrder: (sortOrder as 'asc' | 'desc') || 'asc',
        }
      : undefined;

    const { parts, total } = await pcdbService.listParts(
      {
        categoryId: categoryId as string,
        manufacturer: manufacturer as string,
        isOem: isOem === 'true' ? true : isOem === 'false' ? false : undefined,
        isUniversal: isUniversal === 'true' ? true : isUniversal === 'false' ? false : undefined,
        search: search as string,
        includeDeleted: includeDeleted === 'true',
      },
      pagination
    );

    const paginationResult = pagination
      ? {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total,
          totalPages: Math.ceil(total / pagination.pageSize),
        }
      : undefined;
    return success(res, parts, undefined, paginationResult);
  } catch (err) {
    console.error('Error listing parts:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list parts', 500);
  }
}

export async function getPart(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const part = await pcdbService.getPartById(id);
    if (!part) {
      return error(res, 'NOT_FOUND', 'Part not found', 404);
    }
    return success(res, part);
  } catch (err) {
    console.error('Error getting part:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get part', 500);
  }
}

export async function createPart(req: Request, res: Response) {
  try {
    const {
      categoryId,
      partNumber,
      manufacturerSku,
      upc,
      ean,
      skuAliases,
      name,
      manufacturer,
      interchangeGroupId,
      isOem,
      isUniversal,
      isDiscontinued,
      displayImportance,
      dimensionsJson,
      imageUrl,
      specSheetUrl,
      notes,
      dataSource,
    } = req.body;

    const categoryIdVal = typeof categoryId === 'string' ? categoryId.trim() : categoryId;
    const interchangeGroupIdVal = interchangeGroupId && String(interchangeGroupId).trim()
      ? interchangeGroupId
      : undefined;

    if (!categoryIdVal || !name) {
      return error(res, 'VALIDATION_ERROR', 'categoryId and name are required', 400);
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(String(categoryIdVal))) {
      return error(res, 'VALIDATION_ERROR', 'Please select a valid category from the dropdown', 400);
    }
    if (interchangeGroupIdVal && !UUID_REGEX.test(String(interchangeGroupIdVal))) {
      return error(res, 'VALIDATION_ERROR', 'Invalid interchange group format', 400);
    }

    const userId = (req as any).superAdminEmail;
    const part = await pcdbService.createPart(
      {
        categoryId: categoryIdVal,
        partNumber,
        manufacturerSku,
        upc,
        ean,
        skuAliases,
        name,
        manufacturer,
        interchangeGroupId: interchangeGroupIdVal,
        isOem,
        isUniversal,
        isDiscontinued,
        displayImportance,
        dimensionsJson,
        imageUrl,
        specSheetUrl,
        notes,
        dataSource,
      },
      userId
    );
    res.status(201);
    return success(res, part, 'Part created');
  } catch (err: any) {
    if (err.code === '23503') {
      return error(res, 'VALIDATION_ERROR', 'Invalid category or interchange group – verify they exist', 400);
    }
    if (err.code === '42703') {
      return error(res, 'INTERNAL_ERROR', 'Database schema may be outdated – ensure all migrations have run (manufacturer_sku)', 500);
    }
    if (err.code === '22P02') {
      return error(res, 'VALIDATION_ERROR', 'Invalid UUID format for category or interchange group', 400);
    }
    console.error('Error creating part:', err);
    const msg = process.env.NODE_ENV === 'development' && err?.message
      ? `Failed to create part: ${err.message}`
      : 'Failed to create part';
    return error(res, 'INTERNAL_ERROR', msg, 500);
  }
}

export async function updatePart(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).superAdminEmail;
    const part = await pcdbService.updatePart(id, req.body, userId);
    if (!part) {
      return error(res, 'NOT_FOUND', 'Part not found', 404);
    }
    return success(res, part);
  } catch (err) {
    console.error('Error updating part:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update part', 500);
  }
}

export async function deletePart(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).superAdminEmail;
    const deleted = await pcdbService.deletePart(id, userId);
    if (!deleted) {
      return error(res, 'NOT_FOUND', 'Part not found', 404);
    }
    return success(res, null, 'Part deleted');
  } catch (err) {
    console.error('Error deleting part:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to delete part', 500);
  }
}

export async function searchParts(req: Request, res: Response) {
  try {
    const { q, limit } = req.query;
    if (!q) {
      return error(res, 'VALIDATION_ERROR', 'Query parameter q is required', 400);
    }
    const parts = await pcdbService.searchParts(
      q as string,
      limit ? parseInt(limit as string, 10) : 50
    );
    return success(res, parts);
  } catch (err) {
    console.error('Error searching parts:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to search parts', 500);
  }
}

// =============================================================================
// Helper endpoints
// =============================================================================

export async function getDistinctManufacturers(req: Request, res: Response) {
  try {
    const manufacturers = await pcdbService.getDistinctManufacturers();
    return success(res, manufacturers);
  } catch (err) {
    console.error('Error getting manufacturers:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get manufacturers', 500);
  }
}
