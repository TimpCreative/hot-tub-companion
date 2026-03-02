/**
 * SCdb Controller
 * Spa Configuration Database - API endpoint handlers
 */

import { Request, Response } from 'express';
import * as scdbService from '../services/scdb.service';
import { success, error } from '../utils/response';

// =============================================================================
// Brands
// =============================================================================

export async function listBrands(req: Request, res: Response) {
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

    const { brands, total } = await scdbService.listBrands(
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
    return success(res, brands, undefined, paginationResult);
  } catch (err) {
    console.error('Error listing brands:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list brands', 500);
  }
}

export async function getBrand(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const brand = await scdbService.getBrandById(id);
    if (!brand) {
      return error(res, 'NOT_FOUND', 'Brand not found', 404);
    }
    return success(res, brand);
  } catch (err) {
    console.error('Error getting brand:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get brand', 500);
  }
}

export async function createBrand(req: Request, res: Response) {
  try {
    const { name, logoUrl, websiteUrl, isActive, dataSource } = req.body;
    if (!name) {
      return error(res, 'VALIDATION_ERROR', 'Name is required', 400);
    }

    const existing = await scdbService.getBrandByName(name);
    if (existing) {
      return error(res, 'CONFLICT', 'Brand with this name already exists', 409);
    }

    const userId = (req as any).superAdminEmail;
    const brand = await scdbService.createBrand(
      { name, logoUrl, websiteUrl, isActive, dataSource },
      userId
    );
    res.status(201);
    return success(res, brand, 'Brand created');
  } catch (err) {
    console.error('Error creating brand:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to create brand', 500);
  }
}

export async function updateBrand(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, logoUrl, websiteUrl, isActive, dataSource } = req.body;

    const userId = (req as any).superAdminEmail;
    const brand = await scdbService.updateBrand(
      id,
      { name, logoUrl, websiteUrl, isActive, dataSource },
      userId
    );
    if (!brand) {
      return error(res, 'NOT_FOUND', 'Brand not found', 404);
    }
    return success(res, brand);
  } catch (err) {
    console.error('Error updating brand:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update brand', 500);
  }
}

export async function deleteBrand(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).superAdminEmail;
    const deleted = await scdbService.deleteBrand(id, userId);
    if (!deleted) {
      return error(res, 'NOT_FOUND', 'Brand not found', 404);
    }
    return success(res, null, 'Brand deleted');
  } catch (err) {
    console.error('Error deleting brand:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to delete brand', 500);
  }
}

// =============================================================================
// Model Lines
// =============================================================================

export async function listModelLines(req: Request, res: Response) {
  try {
    const { brandId, includeDeleted } = req.query;
    const modelLines = await scdbService.listModelLines(
      brandId as string,
      includeDeleted === 'true'
    );
    return success(res, modelLines);
  } catch (err) {
    console.error('Error listing model lines:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list model lines', 500);
  }
}

export async function getModelLine(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const modelLine = await scdbService.getModelLineById(id);
    if (!modelLine) {
      return error(res, 'NOT_FOUND', 'Model line not found', 404);
    }
    return success(res, modelLine);
  } catch (err) {
    console.error('Error getting model line:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get model line', 500);
  }
}

export async function createModelLine(req: Request, res: Response) {
  try {
    const { brandId, name, description, isActive, dataSource } = req.body;
    if (!brandId || !name) {
      return error(res, 'VALIDATION_ERROR', 'brandId and name are required', 400);
    }

    const userId = (req as any).superAdminEmail;
    const modelLine = await scdbService.createModelLine(
      { brandId, name, description, isActive, dataSource },
      userId
    );
    res.status(201);
    return success(res, modelLine, 'Model line created');
  } catch (err: any) {
    if (err.code === '23505') {
      return error(res, 'CONFLICT', 'Model line with this name already exists for this brand', 409);
    }
    console.error('Error creating model line:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to create model line', 500);
  }
}

export async function updateModelLine(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, isActive, dataSource } = req.body;

    const userId = (req as any).superAdminEmail;
    const modelLine = await scdbService.updateModelLine(
      id,
      { name, description, isActive, dataSource },
      userId
    );
    if (!modelLine) {
      return error(res, 'NOT_FOUND', 'Model line not found', 404);
    }
    return success(res, modelLine);
  } catch (err) {
    console.error('Error updating model line:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update model line', 500);
  }
}

export async function deleteModelLine(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).superAdminEmail;
    const deleted = await scdbService.deleteModelLine(id, userId);
    if (!deleted) {
      return error(res, 'NOT_FOUND', 'Model line not found', 404);
    }
    return success(res, null, 'Model line deleted');
  } catch (err) {
    console.error('Error deleting model line:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to delete model line', 500);
  }
}

// =============================================================================
// Spa Models
// =============================================================================

export async function listSpaModels(req: Request, res: Response) {
  try {
    const { brandId, modelLineId, year, search, includeDeleted, page, pageSize, sortBy, sortOrder } = req.query;
    const pagination = page && pageSize
      ? {
          page: parseInt(page as string, 10),
          pageSize: parseInt(pageSize as string, 10),
          sortBy: sortBy as string,
          sortOrder: (sortOrder as 'asc' | 'desc') || 'asc',
        }
      : undefined;

    const { spaModels, total } = await scdbService.listSpaModels(
      {
        brandId: brandId as string,
        modelLineId: modelLineId as string,
        year: year ? parseInt(year as string, 10) : undefined,
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
    return success(res, spaModels, undefined, paginationResult);
  } catch (err) {
    console.error('Error listing spa models:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list spa models', 500);
  }
}

export async function getSpaModel(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const spaModel = await scdbService.getSpaModelById(id);
    if (!spaModel) {
      return error(res, 'NOT_FOUND', 'Spa model not found', 404);
    }
    return success(res, spaModel);
  } catch (err) {
    console.error('Error getting spa model:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get spa model', 500);
  }
}

export async function createSpaModel(req: Request, res: Response) {
  try {
    const {
      modelLineId,
      brandId,
      name,
      year,
      manufacturerSku,
      waterCapacityGallons,
      jetCount,
      seatingCapacity,
      dimensionsLengthInches,
      dimensionsWidthInches,
      dimensionsHeightInches,
      weightDryLbs,
      weightFilledLbs,
      electricalRequirement,
      hasOzone,
      hasUv,
      hasSaltSystem,
      imageUrl,
      specSheetUrl,
      isDiscontinued,
      notes,
      dataSource,
    } = req.body;

    if (!modelLineId || !brandId || !name || !year) {
      return error(res, 'VALIDATION_ERROR', 'modelLineId, brandId, name, and year are required', 400);
    }

    const userId = (req as any).superAdminEmail;
    const spaModel = await scdbService.createSpaModel(
      {
        modelLineId,
        brandId,
        name,
        year,
        manufacturerSku,
        waterCapacityGallons,
        jetCount,
        seatingCapacity,
        dimensionsLengthInches,
        dimensionsWidthInches,
        dimensionsHeightInches,
        weightDryLbs,
        weightFilledLbs,
        electricalRequirement,
        hasOzone,
        hasUv,
        hasSaltSystem,
        imageUrl,
        specSheetUrl,
        isDiscontinued,
        notes,
        dataSource,
      },
      userId
    );
    res.status(201);
    return success(res, spaModel, 'Spa model created');
  } catch (err: any) {
    if (err.code === '23505') {
      return error(res, 'CONFLICT', 'Spa model with this name and year already exists for this model line', 409);
    }
    console.error('Error creating spa model:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to create spa model', 500);
  }
}

export async function createSpaModelsBulk(req: Request, res: Response) {
  try {
    const {
      modelLineId,
      brandId,
      name,
      years,
      manufacturerSku,
      waterCapacityGallons,
      jetCount,
      seatingCapacity,
      dimensionsLengthInches,
      dimensionsWidthInches,
      dimensionsHeightInches,
      weightDryLbs,
      weightFilledLbs,
      electricalRequirement,
      hasOzone,
      hasUv,
      hasSaltSystem,
      hasJacuzziTrue,
      imageUrl,
      specSheetUrl,
      isDiscontinued,
      notes,
      dataSource,
    } = req.body;

    if (!modelLineId || !brandId || !name || !years || !Array.isArray(years) || years.length === 0) {
      return error(res, 'VALIDATION_ERROR', 'modelLineId, brandId, name, and years (non-empty array) are required', 400);
    }

    const userId = (req as any).superAdminEmail;
    const validYears = [...new Set(years.map((y: unknown) => parseInt(String(y), 10)).filter((y: number) => !isNaN(y)))].sort((a, b) => a - b);

    if (validYears.length === 0) {
      return error(res, 'VALIDATION_ERROR', 'At least one valid year is required', 400);
    }

    const results = await scdbService.createSpaModelsForYears(
      {
        modelLineId,
        brandId,
        name,
        manufacturerSku,
        waterCapacityGallons,
        jetCount,
        seatingCapacity,
        dimensionsLengthInches,
        dimensionsWidthInches,
        dimensionsHeightInches,
        weightDryLbs,
        weightFilledLbs,
        electricalRequirement,
        hasOzone,
        hasUv,
        hasSaltSystem,
        hasJacuzziTrue,
        imageUrl,
        specSheetUrl,
        isDiscontinued,
        notes,
        dataSource,
      },
      validYears,
      userId
    );

    res.status(201);
    return success(res, results, `Created ${results.created.length} spa model(s)`);
  } catch (err: any) {
    console.error('Error creating spa models bulk:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to create spa models', 500);
  }
}

export async function updateSpaModel(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).superAdminEmail;
    const spaModel = await scdbService.updateSpaModel(id, req.body, userId);
    if (!spaModel) {
      return error(res, 'NOT_FOUND', 'Spa model not found', 404);
    }
    return success(res, spaModel);
  } catch (err) {
    console.error('Error updating spa model:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update spa model', 500);
  }
}

export async function deleteSpaModel(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).superAdminEmail;
    const deleted = await scdbService.deleteSpaModel(id, userId);
    if (!deleted) {
      return error(res, 'NOT_FOUND', 'Spa model not found', 404);
    }
    return success(res, null, 'Spa model deleted');
  } catch (err) {
    console.error('Error deleting spa model:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to delete spa model', 500);
  }
}

export async function searchSpaModels(req: Request, res: Response) {
  try {
    const { q, limit } = req.query;
    if (!q) {
      return error(res, 'VALIDATION_ERROR', 'Query parameter q is required', 400);
    }
    const spaModels = await scdbService.searchSpaModels(
      q as string,
      limit ? parseInt(limit as string, 10) : 50
    );
    return success(res, spaModels);
  } catch (err) {
    console.error('Error searching spa models:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to search spa models', 500);
  }
}

// =============================================================================
// Helper endpoints
// =============================================================================

export async function getBrandYears(req: Request, res: Response) {
  try {
    const { brandId } = req.params;
    const years = await scdbService.getDistinctYearsForBrand(brandId);
    return success(res, years);
  } catch (err) {
    console.error('Error getting brand years:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get brand years', 500);
  }
}

export async function getModelLineModelNames(req: Request, res: Response) {
  try {
    const { modelLineId } = req.params;
    const names = await scdbService.getDistinctModelNames(modelLineId);
    return success(res, names);
  } catch (err) {
    console.error('Error getting model names:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get model names', 500);
  }
}

export async function getModelYears(req: Request, res: Response) {
  try {
    const { modelLineId, modelName } = req.params;
    const years = await scdbService.getYearsForModel(modelLineId, modelName);
    return success(res, years);
  } catch (err) {
    console.error('Error getting model years:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get model years', 500);
  }
}

// =============================================================================
// Public API (for mobile app)
// =============================================================================

export async function getPublicBrands(req: Request, res: Response) {
  try {
    const tenantId = (req as any).tenant?.id;
    const brands = await scdbService.getActiveBrands(tenantId);
    return success(res, brands);
  } catch (err) {
    console.error('Error getting public brands:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get brands', 500);
  }
}

export async function getPublicModelLines(req: Request, res: Response) {
  try {
    const { brandId } = req.params;
    const modelLines = await scdbService.listModelLines(brandId, false);
    return success(res, modelLines.filter(ml => ml.isActive));
  } catch (err) {
    console.error('Error getting public model lines:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get model lines', 500);
  }
}

export async function getPublicSpaModels(req: Request, res: Response) {
  try {
    const { modelLineId } = req.params;
    const { spaModels } = await scdbService.listSpaModels({
      modelLineId,
      includeDeleted: false,
    });
    return success(res, spaModels.filter(sm => !sm.isDiscontinued));
  } catch (err) {
    console.error('Error getting public spa models:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get spa models', 500);
  }
}

// =============================================================================
// Electrical Configs
// =============================================================================

export async function getElectricalConfigs(req: Request, res: Response) {
  try {
    const { spaModelId } = req.params;
    const configs = await scdbService.getElectricalConfigsForSpa(spaModelId);
    return success(res, configs);
  } catch (err) {
    console.error('Error getting electrical configs:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get electrical configs', 500);
  }
}

export async function createElectricalConfig(req: Request, res: Response) {
  try {
    const { spaModelId } = req.params;
    const { voltage, voltageUnit, frequencyHz, amperage, sortOrder } = req.body;

    if (!voltage || !amperage) {
      return error(res, 'VALIDATION_ERROR', 'voltage and amperage are required', 400);
    }

    const config = await scdbService.createElectricalConfig(spaModelId, {
      voltage,
      voltageUnit,
      frequencyHz,
      amperage,
      sortOrder,
    });
    res.status(201);
    return success(res, config, 'Electrical config created');
  } catch (err) {
    console.error('Error creating electrical config:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to create electrical config', 500);
  }
}

export async function updateElectricalConfig(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { voltage, voltageUnit, frequencyHz, amperage, sortOrder } = req.body;

    const config = await scdbService.updateElectricalConfig(id, {
      voltage,
      voltageUnit,
      frequencyHz,
      amperage,
      sortOrder,
    });
    if (!config) {
      return error(res, 'NOT_FOUND', 'Electrical config not found', 404);
    }
    return success(res, config);
  } catch (err) {
    console.error('Error updating electrical config:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update electrical config', 500);
  }
}

export async function deleteElectricalConfig(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const deleted = await scdbService.deleteElectricalConfig(id);
    if (!deleted) {
      return error(res, 'NOT_FOUND', 'Electrical config not found', 404);
    }
    return success(res, null, 'Electrical config deleted');
  } catch (err) {
    console.error('Error deleting electrical config:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to delete electrical config', 500);
  }
}

export async function replaceElectricalConfigs(req: Request, res: Response) {
  try {
    const { spaModelId } = req.params;
    const { configs } = req.body;

    if (!Array.isArray(configs)) {
      return error(res, 'VALIDATION_ERROR', 'configs must be an array', 400);
    }

    const result = await scdbService.replaceElectricalConfigs(spaModelId, configs);
    return success(res, result, 'Electrical configs updated');
  } catch (err) {
    console.error('Error replacing electrical configs:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to replace electrical configs', 500);
  }
}
