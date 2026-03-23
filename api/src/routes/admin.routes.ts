import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { adminRoleGuard } from '../middleware/roleGuard';
import * as adminProductsController from '../controllers/adminProducts.controller';
import * as adminBrandingController from '../controllers/adminBranding.controller';
import * as adminBrandingMediaController from '../controllers/adminBrandingMedia.controller';
import * as adminAppSetupController from '../controllers/adminAppSetup.controller';

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

// Products & mapping
router.get('/products', adminProductsController.listProducts);
router.get('/products/:id/uhtd-suggestions', adminProductsController.getUhtdSuggestions);
router.post('/products/:id/map', adminProductsController.confirmMapping);
router.delete('/products/:id/map', adminProductsController.clearMapping);
router.put('/products/:id/visibility', adminProductsController.setVisibility);
router.post('/products/sync', adminProductsController.syncNow);

// Branding / settings
router.get('/settings/branding', adminBrandingController.getBranding);
router.put('/settings/branding', adminBrandingController.updateBranding);

// App setup (onboarding config, etc.)
router.get('/settings/app-setup', adminAppSetupController.getAppSetup);
router.put('/settings/app-setup', adminAppSetupController.updateAppSetup);

// Branding media uploads (logos)
router.post(
  '/settings/branding/media/upload',
  upload.single('file'),
  adminBrandingMediaController.uploadBrandingMedia
);

export default router;

