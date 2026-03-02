import { Router } from 'express';
import * as mergeController from '../controllers/merge.controller';

const router = Router();

// Brand merge
router.post('/brands/preview', mergeController.previewBrandMerge);
router.post('/brands', mergeController.mergeBrands);

// Model line merge
router.post('/model-lines/preview', mergeController.previewModelLineMerge);
router.post('/model-lines', mergeController.mergeModelLines);

// Spa merge
router.post('/spas/preview', mergeController.previewSpaMerge);
router.post('/spas', mergeController.mergeSpas);

export default router;
