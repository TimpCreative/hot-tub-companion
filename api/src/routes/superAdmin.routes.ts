import { Router } from 'express';
import * as superAdminController from '../controllers/superAdmin.controller';
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
router.get('/settings', superAdminController.getSettings);

// Whitelist management
router.post('/whitelist', superAdminController.addWhitelistEmail);
router.delete('/whitelist/:email', superAdminController.removeWhitelistEmail);
router.post('/whitelist/invite', superAdminController.sendInviteEmail);

export default router;
