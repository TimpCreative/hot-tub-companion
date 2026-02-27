import { Router } from 'express';
import * as auditController from '../controllers/audit.controller';
import * as reviewController from '../controllers/review.controller';

const router = Router();

// Audit logs
router.get('/logs', auditController.getAuditLogs);
router.get('/stats', auditController.getAuditStats);

// Review queue
router.get('/review/pending', reviewController.getPendingCompatibilities);
router.get('/review/stats', reviewController.getReviewStats);
router.post('/review/confirm', reviewController.bulkConfirmCompatibilities);
router.post('/review/reject', reviewController.bulkRejectCompatibilities);

export default router;
