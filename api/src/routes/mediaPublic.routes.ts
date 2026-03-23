import { Router } from 'express';
import * as mediaServeController from '../controllers/mediaServe.controller';

const router = Router();
router.get('/serve/:id', mediaServeController.serveMediaById);
router.get('/serve', mediaServeController.serveMedia);

export default router;
