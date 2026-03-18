import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminRoleGuard } from '../middleware/roleGuard';
import * as adminProductsController from '../controllers/adminProducts.controller';
import * as adminBrandingController from '../controllers/adminBranding.controller';

const router = Router();

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

export default router;

