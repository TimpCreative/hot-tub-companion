import { Router } from 'express';
import * as statsController from '../controllers/stats.controller';

const router = Router();

router.get('/uhtd', statsController.getUhtdStats);
router.get('/search', statsController.searchUhtd);

export default router;
