import { Router, Request, Response } from 'express';
import { success } from '../utils/response';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  success(res, { status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
