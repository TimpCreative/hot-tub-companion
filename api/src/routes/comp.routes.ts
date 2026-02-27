/**
 * Comp Routes
 * Compatibility Groups and part_spa_compatibility - Admin routes
 */

import { Router } from 'express';
import * as compController from '../controllers/comp.controller';

const router = Router();

// Stats
router.get('/stats', compController.getCompatibilityStats);

// Review Queue (pending compatibilities)
router.get('/review-queue', compController.getPendingReview);

// Generate Comp ID
router.get('/generate-id', compController.generateCompId);

// Near-match suggestions
router.post('/near-matches', compController.findNearMatchComps);

// Assign part to comp
router.post('/assign-part', compController.assignPartToComp);

// Part-Spa Compatibility
router.get('/compatibility/part/:partId', compController.getPartCompatibilities);
router.get('/compatibility/spa/:spaModelId', compController.getSpaCompatibilities);
router.post('/compatibility', compController.createCompatibility);
router.post('/compatibility/bulk', compController.createBulkCompatibilities);
router.patch('/compatibility/:partId/:spaModelId/status', compController.updateCompatibilityStatus);
router.delete('/compatibility/:partId/:spaModelId', compController.deleteCompatibility);

// Compatibility Groups (Comps)
router.get('/', compController.listComps);
router.get('/:id', compController.getComp);
router.get('/:id/spas', compController.getCompSpas);
router.get('/:id/parts', compController.getCompParts);
router.post('/', compController.createComp);
router.put('/:id', compController.updateComp);
router.delete('/:id', compController.deleteComp);
router.post('/:id/spas', compController.addSpasToComp);
router.delete('/:id/spas', compController.removeSpasFromComp);
router.put('/:id/spas', compController.setCompSpas);

export default router;
