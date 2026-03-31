import { Router } from 'express';
import * as superAdminController from '../controllers/superAdmin.controller';
import * as superAdminBrandingController from '../controllers/superAdminBranding.controller';
import * as superAdminConsumerUhtdController from '../controllers/superAdminConsumerUhtd.controller';
import * as superAdminAnnouncementsController from '../controllers/superAdminAnnouncements.controller';
import * as superAdminJournalController from '../controllers/superAdminJournal.controller';
import * as platformUsersController from '../controllers/platformUsers.controller';
import { superAdminAuth } from '../middleware/superAdminAuth';
import { authRateLimiter, superAdminAnnouncementRateLimiter } from '../middleware/rateLimiter';

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
router.get('/tenants/:id/entitlements', superAdminController.getTenantEntitlements);
router.put('/tenants/:id/entitlements', superAdminController.updateTenantEntitlements);
router.put('/tenants/:id/pos', superAdminController.updateTenantPosConfig);
router.post('/tenants/:id/pos/test', superAdminController.testTenantPosConnection);
router.post('/tenants/:id/pos/sync', superAdminController.syncTenantCatalog);
router.get('/settings', superAdminController.getSettings);

router.get('/consumer-uhtd-suggestions', superAdminConsumerUhtdController.listConsumerSuggestions);
router.patch('/consumer-uhtd-suggestions/:id', superAdminConsumerUhtdController.updateConsumerSuggestion);

// Global announcements
router.post(
  '/announcements/send',
  superAdminAnnouncementRateLimiter,
  superAdminAnnouncementsController.sendAnnouncement
);

router.get('/journal', superAdminJournalController.listJournalEntries);
router.post('/journal', superAdminJournalController.createJournalEntry);
router.put('/journal/:id', superAdminJournalController.updateJournalEntry);
router.delete('/journal/:id', superAdminJournalController.deleteJournalEntry);
router.post('/journal/:id/reorder', superAdminJournalController.reorderJournalEntry);

// Platform users (super/tenant admins in DB)
router.get('/platform-users', platformUsersController.listPlatformUsers);
router.post('/platform-users', platformUsersController.addPlatformUser);
router.put('/platform-users/:id', platformUsersController.updatePlatformUser);
router.delete('/platform-users/:id', platformUsersController.removePlatformUser);

// Whitelist management
router.post('/whitelist', superAdminController.addWhitelistEmail);
router.delete('/whitelist/:email', superAdminController.removeWhitelistEmail);
router.post('/whitelist/invite', superAdminController.sendInviteEmail);

export default router;
