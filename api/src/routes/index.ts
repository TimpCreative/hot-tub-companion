import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import superAdminRoutes from './superAdmin.routes';
import * as tenantController from '../controllers/tenant.controller';
import { publicRoutes as scdbPublicRoutes, adminRoutes as scdbAdminRoutes } from './scdb.routes';
import pcdbRoutes from './pcdb.routes';
import compRoutes from './comp.routes';
import qdbRoutes from './qdb.routes';
import auditRoutes from './audit.routes';
import importRoutes from './import.routes';
import statsRoutes from './stats.routes';
import mediaRoutes from './media.routes';
import { superAdminAuth } from '../middleware/superAdminAuth';

const router = Router();

router.use(healthRoutes);

router.use('/api/v1/auth', authRoutes);
router.get('/api/v1/tenant/config', tenantController.getTenantConfig);

// Public SCdb routes (tenant API key required)
router.use('/api/v1/scdb', scdbPublicRoutes);

// Super Admin routes
router.use('/api/v1/super-admin', superAdminRoutes);

// Super Admin UHTD routes
router.use('/api/v1/super-admin/scdb', superAdminAuth, scdbAdminRoutes);
router.use('/api/v1/super-admin/pcdb', superAdminAuth, pcdbRoutes);
router.use('/api/v1/super-admin/comps', superAdminAuth, compRoutes);
router.use('/api/v1/super-admin/qdb', superAdminAuth, qdbRoutes);
router.use('/api/v1/super-admin/audit', superAdminAuth, auditRoutes);
router.use('/api/v1/super-admin/import', superAdminAuth, importRoutes);
router.use('/api/v1/super-admin/stats', superAdminAuth, statsRoutes);
router.use('/api/v1/super-admin/media', superAdminAuth, mediaRoutes);

export default router;
