import { Router } from 'express';
import * as controller from '../controllers/superAdminShopifyMap.controller';

const router = Router();

router.get('/inbox', controller.inboxList);
router.get('/inbox/:posProductId', controller.inboxDetail);
router.post('/inbox/:posProductId/reject', controller.inboxReject);
router.post('/inbox/:posProductId/publish', controller.inboxPublish);
router.post('/inbox/:posProductId/send-review', controller.inboxSendReview);
router.post('/bulk-reject', controller.bulkReject);

router.get('/review-queue', controller.reviewQueueList);
router.post('/review-queue/:id/dismiss', controller.reviewQueueDismiss);
router.post('/review-queue/:id/approve', controller.reviewQueueApprove);

export default router;
