import { Router } from 'express';
import * as superAdminController from '../controllers/superAdmin.controller';
import * as superAdminBrandingController from '../controllers/superAdminBranding.controller';
import * as superAdminConsumerUhtdController from '../controllers/superAdminConsumerUhtd.controller';
import { superAdminAuth } from '../middleware/superAdminAuth';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes (no auth required) - for registration
router.post('/auth/check-email', authRateLimiter, superAdminController.checkEmailAllowed);
router.post('/auth/register', authRateLimiter, superAdminController.registerSuperAdmin);

// Protected routes (super admin auth required)
router.use(superAdminAuth);

router.get('/tenants', superAdminController.listTenants);
router.post('/tenants', superAdminController.createTenant);
router.get('/tenants/:id/branding', superAdminBrandingController.getTenantBranding);
router.put('/tenants/:id/branding', superAdminBrandingController.updateTenantBranding);
router.get('/tenants/:id/pos', superAdminController.getTenantPosConfig);
router.put('/tenants/:id/pos', superAdminController.updateTenantPosConfig);
router.post('/tenants/:id/pos/test', superAdminController.testTenantPosConnection);
router.post('/tenants/:id/pos/sync', superAdminController.syncTenantCatalog);
router.get('/settings', superAdminController.getSettings);

router.get('/consumer-uhtd-suggestions', superAdminConsumerUhtdController.listConsumerSuggestions);
router.patch('/consumer-uhtd-suggestions/:id', superAdminConsumerUhtdController.updateConsumerSuggestion);

// Whitelist management
router.post('/whitelist', superAdminController.addWhitelistEmail);
router.delete('/whitelist/:email', superAdminController.removeWhitelistEmail);
router.post('/whitelist/invite', superAdminController.sendInviteEmail);

export default router;
