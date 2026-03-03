/**
 * Comp Controller
 * Compatibility Groups and part_spa_compatibility - API endpoint handlers
 */

import { Request, Response } from 'express';
import * as compatibilityService from '../services/compatibility.service';
import { success, error } from '../utils/response';

// =============================================================================
// Part-Spa Compatibility
// =============================================================================

export async function getPartCompatibilities(req: Request, res: Response) {
  try {
    const { partId } = req.params;
    const { status } = req.query;
    const compatibilities = await compatibilityService.getCompatibilitiesForPart(
      partId,
      status as any
    );
    return success(res, compatibilities);
  } catch (err) {
    console.error('Error getting part compatibilities:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get part compatibilities', 500);
  }
}

export async function getSpaCompatibilities(req: Request, res: Response) {
  try {
    const { spaModelId } = req.params;
    const { status } = req.query;
    const compatibilities = await compatibilityService.getCompatibilitiesForSpa(
      spaModelId,
      status as any
    );
    return success(res, compatibilities);
  } catch (err) {
    console.error('Error getting spa compatibilities:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get spa compatibilities', 500);
  }
}

export async function createCompatibility(req: Request, res: Response) {
  try {
    const { partId, spaModelId, status, fitNotes, quantityRequired, position, source } = req.body;

    if (!partId || !spaModelId) {
      return error(res, 'VALIDATION_ERROR', 'partId and spaModelId are required', 400);
    }

    const existing = await compatibilityService.getCompatibility(partId, spaModelId);
    if (existing) {
      return error(res, 'CONFLICT', 'Compatibility already exists', 409);
    }

    const userId = (req as any).superAdminEmail;
    const compatibility = await compatibilityService.createCompatibility(
      { partId, spaModelId, status, fitNotes, quantityRequired, position, source },
      userId
    );
    res.status(201);
    return success(res, compatibility, 'Compatibility created');
  } catch (err) {
    console.error('Error creating compatibility:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to create compatibility', 500);
  }
}

export async function createMatrixCompatibilities(req: Request, res: Response) {
  try {
    const { partIds, spaModelIds, status } = req.body;

    if (!partIds || !spaModelIds || !Array.isArray(partIds) || !Array.isArray(spaModelIds)) {
      return error(res, 'VALIDATION_ERROR', 'partIds and spaModelIds arrays are required', 400);
    }

    if (partIds.length === 0 || spaModelIds.length === 0) {
      return error(res, 'VALIDATION_ERROR', 'partIds and spaModelIds must be non-empty', 400);
    }

    const MAX_PARTS = 500;
    const MAX_SPAS = 500;
    if (partIds.length > MAX_PARTS || spaModelIds.length > MAX_SPAS) {
      return error(
        res,
        'VALIDATION_ERROR',
        `Maximum ${MAX_PARTS} parts and ${MAX_SPAS} spas allowed (250k connections max)`,
        400
      );
    }

    const userId = (req as any).superAdminEmail;
    const result = await compatibilityService.createMatrixCompatibilities(
      partIds,
      spaModelIds,
      { status: status ?? 'pending', source: 'manual' },
      userId
    );
    res.status(201);
    return success(
      res,
      result,
      `Created ${result.created} compatibilities${result.skipped > 0 ? `, ${result.skipped} skipped (already exist)` : ''}`
    );
  } catch (err) {
    console.error('Error creating matrix compatibilities:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to create matrix compatibilities', 500);
  }
}

export async function createBulkCompatibilities(req: Request, res: Response) {
  try {
    const { partId, spaModelIds, status, fitNotes } = req.body;

    if (!partId || !spaModelIds || !Array.isArray(spaModelIds)) {
      return error(res, 'VALIDATION_ERROR', 'partId and spaModelIds array are required', 400);
    }

    const userId = (req as any).superAdminEmail;
    const count = await compatibilityService.createBulkCompatibilities(
      partId,
      spaModelIds,
      { status, fitNotes },
      userId
    );
    res.status(201);
    return success(res, { created: count }, `Created ${count} compatibilities`);
  } catch (err) {
    console.error('Error creating bulk compatibilities:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to create bulk compatibilities', 500);
  }
}

export async function updateCompatibilityStatus(req: Request, res: Response) {
  try {
    const { partId, spaModelId } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'confirmed', 'rejected'].includes(status)) {
      return error(res, 'VALIDATION_ERROR', 'Valid status is required (pending, confirmed, rejected)', 400);
    }

    const userId = (req as any).superAdminEmail;
    const compatibility = await compatibilityService.updateCompatibilityStatus(
      partId,
      spaModelId,
      status,
      userId
    );
    if (!compatibility) {
      return error(res, 'NOT_FOUND', 'Compatibility not found', 404);
    }
    return success(res, compatibility);
  } catch (err) {
    console.error('Error updating compatibility status:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update compatibility status', 500);
  }
}

export async function deleteCompatibility(req: Request, res: Response) {
  try {
    const { partId, spaModelId } = req.params;
    const userId = (req as any).superAdminEmail;
    const deleted = await compatibilityService.deleteCompatibility(partId, spaModelId, userId);
    if (!deleted) {
      return error(res, 'NOT_FOUND', 'Compatibility not found', 404);
    }
    return success(res, null, 'Compatibility deleted');
  } catch (err) {
    console.error('Error deleting compatibility:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to delete compatibility', 500);
  }
}

// =============================================================================
// Review Queue
// =============================================================================

export async function getPendingReview(req: Request, res: Response) {
  try {
    const { page, pageSize } = req.query;
    const pagination = page && pageSize
      ? {
          page: parseInt(page as string, 10),
          pageSize: parseInt(pageSize as string, 10),
        }
      : undefined;

    const { items, total } = await compatibilityService.getPendingCompatibilities(pagination);

    const paginationResult = pagination
      ? {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total,
          totalPages: Math.ceil(total / pagination.pageSize),
        }
      : undefined;
    return success(res, items, undefined, paginationResult);
  } catch (err) {
    console.error('Error getting pending review:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get pending review items', 500);
  }
}

// =============================================================================
// Compatibility Groups (Comps)
// =============================================================================

export async function listComps(req: Request, res: Response) {
  try {
    const { includeDeleted, page, pageSize, sortBy, sortOrder } = req.query;
    const pagination = page && pageSize
      ? {
          page: parseInt(page as string, 10),
          pageSize: parseInt(pageSize as string, 10),
          sortBy: sortBy as string,
          sortOrder: (sortOrder as 'asc' | 'desc') || 'asc',
        }
      : undefined;

    const { comps, total } = await compatibilityService.listComps(
      includeDeleted === 'true',
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
    return success(res, comps, undefined, paginationResult);
  } catch (err) {
    console.error('Error listing comps:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list comps', 500);
  }
}

export async function getComp(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const comp = await compatibilityService.getCompById(id);
    if (!comp) {
      return error(res, 'NOT_FOUND', 'Comp not found', 404);
    }
    return success(res, comp);
  } catch (err) {
    console.error('Error getting comp:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get comp', 500);
  }
}

export async function getCompSpas(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const spas = await compatibilityService.getSpasInComp(id);
    return success(res, spas);
  } catch (err) {
    console.error('Error getting comp spas:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get comp spas', 500);
  }
}

export async function getCompParts(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const partIds = await compatibilityService.getPartsForComp(id);
    return success(res, partIds);
  } catch (err) {
    console.error('Error getting comp parts:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get comp parts', 500);
  }
}

export async function createComp(req: Request, res: Response) {
  try {
    const { id, name, description, spaModelIds } = req.body;

    if (!id) {
      return error(res, 'VALIDATION_ERROR', 'Comp id is required', 400);
    }

    const existing = await compatibilityService.getCompById(id);
    if (existing) {
      return error(res, 'CONFLICT', 'Comp with this ID already exists', 409);
    }

    const userId = (req as any).superAdminEmail;
    const comp = await compatibilityService.createComp(
      { id, name, description, spaModelIds },
      userId
    );
    res.status(201);
    return success(res, comp, 'Comp created');
  } catch (err) {
    console.error('Error creating comp:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to create comp', 500);
  }
}

export async function updateComp(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const userId = (req as any).superAdminEmail;
    const comp = await compatibilityService.updateComp(id, { name, description }, userId);
    if (!comp) {
      return error(res, 'NOT_FOUND', 'Comp not found', 404);
    }
    return success(res, comp);
  } catch (err) {
    console.error('Error updating comp:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update comp', 500);
  }
}

export async function deleteComp(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).superAdminEmail;
    const deleted = await compatibilityService.deleteComp(id, userId);
    if (!deleted) {
      return error(res, 'NOT_FOUND', 'Comp not found', 404);
    }
    return success(res, null, 'Comp deleted');
  } catch (err) {
    console.error('Error deleting comp:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to delete comp', 500);
  }
}

export async function addSpasToComp(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { spaModelIds } = req.body;

    if (!spaModelIds || !Array.isArray(spaModelIds)) {
      return error(res, 'VALIDATION_ERROR', 'spaModelIds array is required', 400);
    }

    const userId = (req as any).superAdminEmail;
    const count = await compatibilityService.addSpasToComp(id, spaModelIds, userId);
    return success(res, { added: count }, `Added ${count} spas to comp`);
  } catch (err) {
    console.error('Error adding spas to comp:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to add spas to comp', 500);
  }
}

export async function removeSpasFromComp(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { spaModelIds } = req.body;

    if (!spaModelIds || !Array.isArray(spaModelIds)) {
      return error(res, 'VALIDATION_ERROR', 'spaModelIds array is required', 400);
    }

    const userId = (req as any).superAdminEmail;
    const count = await compatibilityService.removeSpasFromComp(id, spaModelIds, userId);
    return success(res, { removed: count }, `Removed ${count} spas from comp`);
  } catch (err) {
    console.error('Error removing spas from comp:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to remove spas from comp', 500);
  }
}

export async function setCompSpas(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { spaModelIds } = req.body;

    if (!spaModelIds || !Array.isArray(spaModelIds)) {
      return error(res, 'VALIDATION_ERROR', 'spaModelIds array is required', 400);
    }

    const userId = (req as any).superAdminEmail;
    await compatibilityService.setCompSpas(id, spaModelIds, userId);
    return success(res, { spaCount: spaModelIds.length }, 'Comp spas updated');
  } catch (err) {
    console.error('Error setting comp spas:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to set comp spas', 500);
  }
}

// =============================================================================
// Near-Match Suggestions
// =============================================================================

export async function findNearMatchComps(req: Request, res: Response) {
  try {
    const { spaModelIds, categoryId, threshold } = req.body;

    if (!spaModelIds || !Array.isArray(spaModelIds)) {
      return error(res, 'VALIDATION_ERROR', 'spaModelIds array is required', 400);
    }

    const matches = await compatibilityService.findNearMatchComps(
      spaModelIds,
      categoryId,
      threshold ? parseFloat(threshold) : 0.5
    );
    return success(res, matches);
  } catch (err) {
    console.error('Error finding near-match comps:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to find near-match comps', 500);
  }
}

// =============================================================================
// Assign Part to Comp
// =============================================================================

export async function assignPartToComp(req: Request, res: Response) {
  try {
    const { partId, compId, status } = req.body;

    if (!partId || !compId) {
      return error(res, 'VALIDATION_ERROR', 'partId and compId are required', 400);
    }

    const userId = (req as any).superAdminEmail;
    const count = await compatibilityService.assignPartToCompSpas(partId, compId, {
      status,
      userId,
    });
    res.status(201);
    return success(res, { created: count }, `Created ${count} compatibilities from comp`);
  } catch (err) {
    console.error('Error assigning part to comp:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to assign part to comp', 500);
  }
}

// =============================================================================
// Generate Comp ID
// =============================================================================

export async function generateCompId(req: Request, res: Response) {
  try {
    const { brandAbbrev, categoryAbbrev } = req.query;

    if (!brandAbbrev || !categoryAbbrev) {
      return error(res, 'VALIDATION_ERROR', 'brandAbbrev and categoryAbbrev are required', 400);
    }

    const id = await compatibilityService.generateCompIdSuggestion(
      brandAbbrev as string,
      categoryAbbrev as string
    );
    return success(res, { id });
  } catch (err) {
    console.error('Error generating comp ID:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to generate comp ID', 500);
  }
}

// =============================================================================
// Stats
// =============================================================================

export async function getCompatibilityStats(req: Request, res: Response) {
  try {
    const stats = await compatibilityService.getCompatibilityStats();
    return success(res, stats);
  } catch (err) {
    console.error('Error getting compatibility stats:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get compatibility stats', 500);
  }
}
