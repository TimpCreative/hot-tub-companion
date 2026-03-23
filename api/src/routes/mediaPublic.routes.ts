import { Router, Request, Response, NextFunction } from 'express';
import * as mediaServeController from '../controllers/mediaServe.controller';

/** Ensure CORS headers on all media responses (including 404/500) so cross-origin img loads don't fail */
function mediaCors(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}

const router = Router();
router.use(mediaCors);
router.get('/serve/:id', mediaServeController.serveMediaById);
router.get('/serve', mediaServeController.serveMedia);

export default router;
