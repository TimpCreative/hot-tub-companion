/**
 * PCdb Routes
 * Parts Catalog Database - Admin routes
 */

import { Router } from 'express';
import * as pcdbController from '../controllers/pcdb.controller';

const router = Router();

// Categories
router.get('/categories', pcdbController.listCategories);
router.get('/categories/:id', pcdbController.getCategory);
router.get('/categories/:id/ancestors', pcdbController.getCategoryAncestors);
router.post('/categories', pcdbController.createCategory);
router.put('/categories/:id', pcdbController.updateCategory);
router.delete('/categories/:id', pcdbController.deleteCategory);

// Interchange Groups
router.get('/interchange-groups', pcdbController.listInterchangeGroups);
router.get('/interchange-groups/:id', pcdbController.getInterchangeGroup);
router.get('/interchange-groups/:id/parts', pcdbController.getInterchangeGroupParts);
router.post('/interchange-groups', pcdbController.createInterchangeGroup);
router.put('/interchange-groups/:id', pcdbController.updateInterchangeGroup);
router.delete('/interchange-groups/:id', pcdbController.deleteInterchangeGroup);

// Parts
router.get('/parts', pcdbController.listParts);
router.get('/parts/search', pcdbController.searchParts);
router.get('/parts/:id', pcdbController.getPart);
router.post('/parts', pcdbController.createPart);
router.put('/parts/:id', pcdbController.updatePart);
router.delete('/parts/:id', pcdbController.deletePart);

// Helper endpoints
router.get('/manufacturers', pcdbController.getDistinctManufacturers);

export default router;
