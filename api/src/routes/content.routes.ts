import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as contentController from '../controllers/content.controller';

const router = Router();

router.get('/content/categories', contentController.listCategories);
router.get('/content', authMiddleware, contentController.listCustomerContent);
router.get('/content/:id', authMiddleware, contentController.getCustomerContent);

export default router;
