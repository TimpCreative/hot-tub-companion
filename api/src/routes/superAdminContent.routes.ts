import { Router } from 'express';
import * as superAdminContentController from '../controllers/superAdminContent.controller';

const router = Router();

router.get('/categories', superAdminContentController.listCategories);
router.post('/categories', superAdminContentController.createCategory);
router.put('/categories/:id', superAdminContentController.updateCategory);
router.delete('/categories/:id', superAdminContentController.deleteCategory);
router.get('/', superAdminContentController.listContent);
router.post('/', superAdminContentController.createContent);
router.put('/:id', superAdminContentController.updateContent);
router.delete('/:id', superAdminContentController.deleteContent);

export default router;
