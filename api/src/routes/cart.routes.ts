import { Router } from 'express';
import * as cartController from '../controllers/cart.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/cart', authMiddleware, cartController.getCartState);
router.post('/cart/items', authMiddleware, cartController.postCartItem);
router.patch('/cart/lines', authMiddleware, cartController.patchCartLine);
router.delete('/cart/lines', authMiddleware, cartController.deleteCartLine);
router.post('/cart/checkout', authMiddleware, cartController.postCartCheckout);

export default router;
