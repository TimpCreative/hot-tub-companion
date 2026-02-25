import { Router } from 'express';
import * as superAdminController from '../controllers/superAdmin.controller';
import { superAdminAuth } from '../middleware/superAdminAuth';

const router = Router();

router.use(superAdminAuth);

router.get('/tenants', superAdminController.listTenants);
router.post('/tenants', superAdminController.createTenant);

export default router;
