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
import waterCareCustomerRoutes, { adminRoutes as waterCareAdminRoutes } from './waterCare.routes';
import contentRoutes from './content.routes';
import superAdminContentRoutes from './superAdminContent.routes';
import { superAdminAuth } from '../middleware/superAdminAuth';
import { cronAuth } from '../middleware/cronAuth';
import { easBuildConfigAuth } from '../middleware/easBuildConfigAuth';
import * as cronController from '../controllers/cron.controller';
import * as internalEasController from '../controllers/internalEas.controller';
import adminRoutes from './admin.routes';
import productsRoutes from './products.routes';
import cartRoutes from './cart.routes';
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
router.post(
  '/api/v1/internal/cron/sync-shopify-catalog',
  cronAuth,
  cronController.syncShopifyCatalog
);

// EAS build: fetch tenant API key by slug (EAS_BUILD_CONFIG_SECRET required)
router.get(
  '/api/v1/internal/eas-tenant-config',
  easBuildConfigAuth,
  internalEasController.getEasTenantConfig
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

// Super Admin UHTD routes must also be before generic /api/v1 routers because
// several tenant/customer routers register auth middleware at their root.
router.use('/api/v1/super-admin/scdb', superAdminAuth, scdbAdminRoutes);
router.use('/api/v1/super-admin/pcdb', superAdminAuth, pcdbRoutes);
router.use('/api/v1/super-admin/comps', superAdminAuth, compRoutes);
router.use('/api/v1/super-admin/qdb', superAdminAuth, qdbRoutes);
router.use('/api/v1/super-admin/audit', superAdminAuth, auditRoutes);
router.use('/api/v1/super-admin/import', superAdminAuth, importRoutes);
router.use('/api/v1/super-admin/merge', superAdminAuth, mergeRoutes);
router.use('/api/v1/super-admin/stats', superAdminAuth, statsRoutes);
router.use('/api/v1/super-admin/media', superAdminAuth, mediaRoutes);
router.use('/api/v1/super-admin/water-care', superAdminAuth, waterCareAdminRoutes);
router.use('/api/v1/super-admin/content', superAdminAuth, superAdminContentRoutes);

// Customer product routes (tenant API key required; some endpoints require auth)
router.use('/api/v1', waterCareCustomerRoutes);
router.use('/api/v1', contentRoutes);

// Customer product routes (tenant API key required; some endpoints require auth)
router.use('/api/v1', productsRoutes);
router.use('/api/v1', cartRoutes);

// Customer spa profiles (tenant API key + Firebase auth)
router.use('/api/v1', spaProfilesRoutes);

// Customer user profile (tenant API key + Firebase auth)
router.use('/api/v1', usersRoutes);

// Consumer UHTD review queue (tenant API key + Firebase auth; no SCdb writes)
router.use('/api/v1', consumerUhtdSuggestionsRoutes);

export default router;
