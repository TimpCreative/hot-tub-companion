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
import mergeRoutes from './merge.routes';
import statsRoutes from './stats.routes';
import mediaRoutes from './media.routes';
import mediaPublicRoutes from './mediaPublic.routes';
import { superAdminAuth } from '../middleware/superAdminAuth';
import { cronAuth } from '../middleware/cronAuth';
import * as cronController from '../controllers/cron.controller';
import adminRoutes from './admin.routes';
import productsRoutes from './products.routes';
import spaProfilesRoutes from './spaProfiles.routes';
import usersRoutes from './users.routes';
import consumerUhtdSuggestionsRoutes from './consumerUhtdSuggestions.routes';

const router = Router();

router.use(healthRoutes);

router.use('/api/v1/auth', authRoutes);
router.get('/api/v1/tenant/config', tenantController.getTenantConfig);

// Internal cron (CRON_SECRET required)
router.post(
  '/api/v1/internal/cron/dispatch-notifications',
  cronAuth,
  cronController.dispatchNotifications
);

// Public media serve (no auth) - streams from GCS for logos/icons
router.use('/api/v1/media', mediaPublicRoutes);

// Public SCdb routes (tenant API key required)
router.use('/api/v1/scdb', scdbPublicRoutes);

// Retailer admin routes (tenant API key + Firebase auth required)
router.use('/api/v1/admin', adminRoutes);

// Super Admin routes - MUST be before generic /api/v1 to avoid being matched by
// consumerUhtdSuggestionsRoutes (which runs authMiddleware requiring tenant context)
router.use('/api/v1/super-admin', superAdminRoutes);

// Customer product routes (tenant API key required; some endpoints require auth)
router.use('/api/v1', productsRoutes);

// Customer spa profiles (tenant API key + Firebase auth)
router.use('/api/v1', spaProfilesRoutes);

// Customer user profile (tenant API key + Firebase auth)
router.use('/api/v1', usersRoutes);

// Consumer UHTD review queue (tenant API key + Firebase auth; no SCdb writes)
router.use('/api/v1', consumerUhtdSuggestionsRoutes);

// Super Admin UHTD routes
router.use('/api/v1/super-admin/scdb', superAdminAuth, scdbAdminRoutes);
router.use('/api/v1/super-admin/pcdb', superAdminAuth, pcdbRoutes);
router.use('/api/v1/super-admin/comps', superAdminAuth, compRoutes);
router.use('/api/v1/super-admin/qdb', superAdminAuth, qdbRoutes);
router.use('/api/v1/super-admin/audit', superAdminAuth, auditRoutes);
router.use('/api/v1/super-admin/import', superAdminAuth, importRoutes);
router.use('/api/v1/super-admin/merge', superAdminAuth, mergeRoutes);
router.use('/api/v1/super-admin/stats', superAdminAuth, statsRoutes);
router.use('/api/v1/super-admin/media', superAdminAuth, mediaRoutes);

export default router;
