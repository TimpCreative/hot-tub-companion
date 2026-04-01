import { Router } from 'express';
import * as superAdminContentController from '../controllers/superAdminContent.controller';

const router = Router();

router.get('/categories', superAdminContentController.listCategories);
router.post('/categories', superAdminContentController.createCategory);
router.get('/', superAdminContentController.listContent);
router.post('/', superAdminContentController.createContent);
router.put('/:id', superAdminContentController.updateContent);
router.delete('/:id', superAdminContentController.deleteContent);

export default router;
