import { Router, Request, Response, NextFunction } from 'express';
import * as productsController from '../controllers/products.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/** Require Firebase auth when spaProfileId is present (shop compatibility on PDP). */
function productDetailAuthIfSpa(req: Request, res: Response, next: NextFunction): void {
  const raw = req.query.spaProfileId;
  if (typeof raw === 'string' && raw.trim() !== '') {
    authMiddleware(req, res, next);
    return;
  }
  next();
}

// Public-ish endpoints (tenant API key required via tenantMiddleware)
router.get('/products', productsController.listProducts);
router.get('/products/categories', productsController.listProductCategories);
router.get('/products/compatible/:spaProfileId', authMiddleware, productsController.listCompatibleProducts);
router.get('/products/shop/categories', authMiddleware, productsController.listShopCategories);
router.get('/products/shop/price-bounds', authMiddleware, productsController.listShopPriceBounds);
router.get('/products/shop', authMiddleware, productsController.listShopProducts);
router.get('/products/shop/:id/related', authMiddleware, productsController.listRelatedShopProducts);
router.get('/products/:id', productDetailAuthIfSpa, productsController.getProductById);

export default router;

