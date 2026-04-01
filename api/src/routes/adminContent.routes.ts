import { Router } from 'express';
import * as adminContentController from '../controllers/adminContent.controller';

const router = Router();

router.get('/content', adminContentController.listContent);
router.post('/content', adminContentController.createContent);
router.put('/content/:id', adminContentController.updateContent);
router.delete('/content/:id', adminContentController.deleteContent);
router.put('/content/:id/suppress', adminContentController.setSuppression);

export default router;
