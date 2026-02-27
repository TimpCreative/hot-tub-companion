import { Router } from 'express';
import * as importController from '../controllers/import.controller';

const router = Router();

router.post('/brands', importController.importBrands);
router.post('/parts', importController.importParts);
router.post('/compatibility', importController.importCompatibility);

export default router;
