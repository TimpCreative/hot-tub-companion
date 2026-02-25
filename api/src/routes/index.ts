import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import superAdminRoutes from './superAdmin.routes';
import * as tenantController from '../controllers/tenant.controller';

const router = Router();

router.use(healthRoutes);

router.use('/api/v1/auth', authRoutes);
router.get('/api/v1/tenant/config', tenantController.getTenantConfig);

router.use('/api/v1/super-admin', superAdminRoutes);

export default router;
