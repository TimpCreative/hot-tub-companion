import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as spaProfilesController from '../controllers/spaProfiles.controller';

const router = Router();

router.use(authMiddleware);

router.get('/spa-profiles', spaProfilesController.listSpaProfiles);
router.post('/spa-profiles', spaProfilesController.createSpaProfile);
router.delete('/spa-profiles', spaProfilesController.deleteAllSpaProfiles);

export default router;
