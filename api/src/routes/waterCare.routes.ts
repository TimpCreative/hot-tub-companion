import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as waterCareController from '../controllers/waterCare.controller';

export const adminRoutes = Router();
adminRoutes.get('/profiles', waterCareController.listProfiles);
adminRoutes.post('/profiles', waterCareController.createProfile);
adminRoutes.put('/profiles/:id', waterCareController.updateProfile);
adminRoutes.delete('/profiles/:id', waterCareController.deleteProfile);
adminRoutes.get('/mappings', waterCareController.listMappings);
adminRoutes.post('/mappings', waterCareController.createMapping);
adminRoutes.put('/mappings/:id', waterCareController.updateMapping);
adminRoutes.delete('/mappings/:id', waterCareController.deleteMapping);

const customerRoutes = Router();
customerRoutes.use(authMiddleware);
customerRoutes.get('/water-care/:spaProfileId', waterCareController.getResolvedWaterCare);

export default customerRoutes;
