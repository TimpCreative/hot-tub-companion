/**
 * SCdb Routes
 * Spa Configuration Database - Public and Admin routes
 */

import { Router } from 'express';
import * as scdbController from '../controllers/scdb.controller';

// =============================================================================
// Public Routes (tenant API key required)
// =============================================================================

export const publicRoutes = Router();

publicRoutes.get('/brands', scdbController.getPublicBrands);
publicRoutes.get('/brands/:brandId/model-lines', scdbController.getPublicModelLines);
publicRoutes.get('/model-lines/:modelLineId/models', scdbController.getPublicSpaModels);
publicRoutes.get('/search', scdbController.searchSpaModels);

// =============================================================================
// Admin Routes (super admin authentication required)
// =============================================================================

export const adminRoutes = Router();

// Brands
adminRoutes.get('/brands', scdbController.listBrands);
adminRoutes.get('/brands/:id', scdbController.getBrand);
adminRoutes.post('/brands', scdbController.createBrand);
adminRoutes.put('/brands/:id', scdbController.updateBrand);
adminRoutes.delete('/brands/:id', scdbController.deleteBrand);
adminRoutes.get('/brands/:brandId/years', scdbController.getBrandYears);

// Model Lines
adminRoutes.get('/model-lines', scdbController.listModelLines);
adminRoutes.get('/model-lines/:id', scdbController.getModelLine);
adminRoutes.post('/model-lines', scdbController.createModelLine);
adminRoutes.put('/model-lines/:id', scdbController.updateModelLine);
adminRoutes.delete('/model-lines/:id', scdbController.deleteModelLine);
adminRoutes.get('/model-lines/:modelLineId/names', scdbController.getModelLineModelNames);
adminRoutes.get('/model-lines/:modelLineId/names/:modelName/years', scdbController.getModelYears);

// Spa Models
adminRoutes.get('/spa-models', scdbController.listSpaModels);
adminRoutes.get('/spa-models/search', scdbController.searchSpaModels);
adminRoutes.post('/spa-models/bulk', scdbController.createSpaModelsBulk);
adminRoutes.get('/spa-models/:id', scdbController.getSpaModel);
adminRoutes.post('/spa-models', scdbController.createSpaModel);
adminRoutes.put('/spa-models/:id', scdbController.updateSpaModel);
adminRoutes.delete('/spa-models/:id', scdbController.deleteSpaModel);

// Electrical Configs
adminRoutes.get('/spa-models/:spaModelId/electrical', scdbController.getElectricalConfigs);
adminRoutes.post('/spa-models/:spaModelId/electrical', scdbController.createElectricalConfig);
adminRoutes.put('/spa-models/:spaModelId/electrical', scdbController.replaceElectricalConfigs);
adminRoutes.put('/electrical-configs/:id', scdbController.updateElectricalConfig);
adminRoutes.delete('/electrical-configs/:id', scdbController.deleteElectricalConfig);
