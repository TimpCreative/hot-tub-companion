import { Router, Request, Response, NextFunction } from 'express';
import * as mediaServeController from '../controllers/mediaServe.controller';

/** Ensure CORS headers on all media responses (including 404/500) so cross-origin img loads don't fail */
function mediaCors(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  // #region agent log
  const path = req.path || req.url;
  console.log('[MEDIA_DEBUG] route hit', { path, url: req.url, method: req.method });
  fetch('http://127.0.0.1:7244/ingest/a47da7ba-8944-40d5-a7b1-3ca8dd181a2c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97b103'},body:JSON.stringify({sessionId:'97b103',location:'mediaPublic.routes:mediaCors',message:'Media route hit',data:{path,url:req.url,method:req.method},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  next();
}

const router = Router();
router.use(mediaCors);
router.get('/debug/:id', mediaServeController.debugMediaById);
router.get('/serve/:id', mediaServeController.serveMediaById);
router.get('/serve', mediaServeController.serveMedia);

export default router;
