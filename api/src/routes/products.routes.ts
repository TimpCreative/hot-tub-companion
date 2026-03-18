import { Router } from 'express';
import * as productsController from '../controllers/products.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public-ish endpoints (tenant API key required via tenantMiddleware)
router.get('/products', productsController.listProducts);
router.get('/products/categories', productsController.listProductCategories);
router.get('/products/compatible/:spaProfileId', authMiddleware, productsController.listCompatibleProducts);
router.get('/products/:id', productsController.getProductById);

export default router;

