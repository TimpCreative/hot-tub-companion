import { Router } from 'express';
import * as importController from '../controllers/import.controller';

const router = Router();

router.post('/brands', importController.importBrands);
router.post('/model-lines', importController.importModelLines);
router.post('/spas', importController.importSpas);
router.post('/parts', importController.importParts);
router.post('/comps', importController.importCompatibility);
router.post('/compatibility', importController.importCompatibility); // Legacy route

export default router;
