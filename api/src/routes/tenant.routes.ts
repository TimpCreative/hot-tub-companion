import { Router } from 'express';
import * as tenantController from '../controllers/tenant.controller';

const router = Router();

router.get('/config', tenantController.getTenantConfig);

export default router;
