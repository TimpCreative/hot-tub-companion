import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { adminRoleGuard } from '../middleware/roleGuard';
import { notificationSendRateLimiter } from '../middleware/rateLimiter';
import * as adminProductsController from '../controllers/adminProducts.controller';
import * as adminBrandingController from '../controllers/adminBranding.controller';
import * as adminBrandingMediaController from '../controllers/adminBrandingMedia.controller';
import * as adminAppSetupController from '../controllers/adminAppSetup.controller';
import * as adminWaterCareAnalyticsController from '../controllers/adminWaterCareAnalytics.controller';
import * as adminPosController from '../controllers/adminPos.controller';
import * as adminSettingsPosSyncController from '../controllers/adminSettingsPosSync.controller';
import * as adminNotificationsController from '../controllers/adminNotifications.controller';
import * as adminTeamController from '../controllers/adminTeam.controller';
import * as adminSubscriptionsController from '../controllers/adminSubscriptions.controller';
import adminContentRoutes from './adminContent.routes';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// All admin routes require tenant context + Firebase auth + admin role
router.use(authMiddleware);
router.use(adminRoleGuard);

// Admin me (permissions for nav) + Team management
router.get('/me', adminTeamController.getMe);
router.get('/team', adminTeamController.listTeam);
router.get('/team/audit', adminTeamController.getTeamAudit);
router.post('/team/invite', adminTeamController.inviteTeamMember);
router.put('/team/:userId', adminTeamController.updateTeamMember);
router.delete('/team/:userId', adminTeamController.removeTeamMember);

// Products & mapping (static paths before :id)
router.get('/products/export.csv', adminProductsController.exportProductsCsv);
router.post('/products/bulk-selection', adminProductsController.bulkSelection);
router.post('/products/bulk-apply', adminProductsController.bulkApply);
router.post(
  '/products/import',
  upload.single('file'),
  adminProductsController.importProductsCsv
);
router.get('/products/bundles', adminSubscriptionsController.listBundles);
router.post('/products/bundles/preview', adminSubscriptionsController.postBundlePreview);
router.post('/products/bundles', adminSubscriptionsController.postBundle);
router.put('/products/bundles/:id', adminSubscriptionsController.putBundle);
router.delete('/products/bundles/:id', adminSubscriptionsController.removeBundle);
router.get('/products/search-for-bundles', adminProductsController.searchProductsForBundlePicker);
router.get('/products', adminProductsController.listProducts);
router.get('/shopify-collections', adminProductsController.listShopifyCollections);
router.get('/collection-category-maps', adminProductsController.listCollectionCategoryMaps);
router.put(
  '/collection-category-maps/:shopifyCollectionId',
  adminProductsController.upsertCollectionCategoryMap
);
router.delete(
  '/collection-category-maps/:shopifyCollectionId',
  adminProductsController.deleteCollectionCategoryMap
);
router.get('/pcdb-categories', adminProductsController.searchPcdbCategories);
router.get('/products/:id/uhtd-suggestions', adminProductsController.getUhtdSuggestions);
router.post('/products/:id/map', adminProductsController.confirmMapping);
router.delete('/products/:id/map', adminProductsController.clearMapping);
router.put('/products/:id/visibility', adminProductsController.setVisibility);
router.put('/products/:id/subscription-eligible', adminProductsController.putSubscriptionEligible);
router.put('/products/:id/subscription-offer', adminProductsController.putSubscriptionOffer);

// Branding / settings
router.get('/settings/branding', adminBrandingController.getBranding);
router.put('/settings/branding', adminBrandingController.updateBranding);
router.get('/settings/pos', adminPosController.getPosConfig);
router.put('/settings/pos', adminPosController.updatePosConfig);
router.post('/settings/pos/test', adminPosController.testPosConnection);
router.get('/settings/pos/activity', adminPosController.getPosIntegrationActivity);
router.get('/settings/pos/health', adminPosController.getPosHealth);
router.get('/settings/pos/sync/estimate', adminSettingsPosSyncController.getProductSyncEstimate);
router.post('/settings/pos/sync/batch', adminSettingsPosSyncController.syncProductBatch);
router.post('/settings/pos/sync/now', adminSettingsPosSyncController.syncCatalogNow);

// App setup (onboarding config, etc.)
router.get('/settings/app-setup', adminAppSetupController.getAppSetup);
router.put('/settings/app-setup', adminAppSetupController.updateAppSetup);
router.get('/settings/water-care-analytics', adminWaterCareAnalyticsController.getWaterCareAnalytics);

// Content library
router.use('/', adminContentRoutes);

// Notifications (requires can_send_notifications)
router.get(
  '/notifications/automated',
  adminNotificationsController.listAutomatedNotificationTemplates
);
router.get(
  '/notifications/history',
  adminNotificationsController.listNotificationHistory
);
router.get(
  '/notifications',
  adminNotificationsController.listNotifications
);
router.post(
  '/notifications',
  notificationSendRateLimiter,
  adminNotificationsController.createNotification
);
router.put(
  '/notifications/:id',
  notificationSendRateLimiter,
  adminNotificationsController.updateNotification
);
router.delete(
  '/notifications/:id/cancel',
  adminNotificationsController.cancelNotification
);
router.get(
  '/notifications/:id/stats',
  adminNotificationsController.getNotificationStats
);

// Branding media uploads (logos)
router.post(
  '/settings/branding/media/upload',
  upload.single('file'),
  adminBrandingMediaController.uploadBrandingMedia
);

// Subscriptions (Stripe Connect)
router.get('/subscriptions/connect', adminSubscriptionsController.getConnectStatus);
router.post('/subscriptions/connect/onboarding-link', adminSubscriptionsController.postConnectOnboardingLink);
router.post('/subscriptions/connect/dashboard-link', adminSubscriptionsController.postConnectDashboardLink);
router.put('/subscriptions/settings', adminSubscriptionsController.putSubscriptionSettings);
router.get('/subscriptions/bundles', adminSubscriptionsController.listBundles);
router.post('/subscriptions/bundles/preview', adminSubscriptionsController.postBundlePreview);
router.post('/subscriptions/bundles', adminSubscriptionsController.postBundle);
router.put('/subscriptions/bundles/:id', adminSubscriptionsController.putBundle);
router.delete('/subscriptions/bundles/:id', adminSubscriptionsController.removeBundle);
router.get('/subscriptions/customers', adminSubscriptionsController.listTenantCustomerSubscriptions);

export default router;

