import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as waterCareController from '../controllers/waterCare.controller';
import * as waterTestKitsController from '../controllers/waterTestKits.controller';

export const adminRoutes = Router();
adminRoutes.get('/profiles', waterCareController.listProfiles);
adminRoutes.post('/profiles', waterCareController.createProfile);
adminRoutes.put('/profiles/:id', waterCareController.updateProfile);
adminRoutes.delete('/profiles/:id', waterCareController.deleteProfile);
adminRoutes.get('/mappings', waterCareController.listMappings);
adminRoutes.post('/mappings', waterCareController.createMapping);
adminRoutes.put('/mappings/:id', waterCareController.updateMapping);
adminRoutes.delete('/mappings/:id', waterCareController.deleteMapping);
adminRoutes.get('/metrics', waterCareController.listWaterMetrics);
adminRoutes.post('/metrics', waterCareController.createWaterMetric);
adminRoutes.put('/metrics/:id', waterCareController.updateWaterMetric);
adminRoutes.get('/test-kits', waterTestKitsController.listKits);
adminRoutes.get('/test-kits/:id', waterTestKitsController.getKit);
adminRoutes.post('/test-kits', waterTestKitsController.createKit);
adminRoutes.put('/test-kits/:id', waterTestKitsController.updateKit);
adminRoutes.delete('/test-kits/:id', waterTestKitsController.deleteKit);

const customerRoutes = Router();
customerRoutes.use(authMiddleware);
customerRoutes.get('/water-care/:spaProfileId', waterCareController.getResolvedWaterCare);
customerRoutes.post('/water-tests', waterCareController.createWaterTest);
customerRoutes.get('/water-tests/:spaProfileId', waterCareController.listWaterTests);

export default customerRoutes;
