import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as maintenanceController from '../controllers/maintenance.controller';

const router = Router();

router.use(authMiddleware);

router.get('/maintenance', maintenanceController.listMaintenance);
router.post('/maintenance', maintenanceController.createCustomMaintenance);
router.post('/maintenance/:id/complete', maintenanceController.completeMaintenance);
router.put('/maintenance/:id', maintenanceController.updateCustomMaintenance);
router.delete('/maintenance/:id', maintenanceController.deleteCustomMaintenance);

export default router;
