import { Request, Response, NextFunction } from 'express';
import { env } from '../config/environment';
import { error } from '../utils/response';

export function cronAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    error(res, 'SERVICE_UNAVAILABLE', 'Cron dispatch is not configured', 503);
    return;
  }

  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const xSecret = req.headers['x-cron-secret'] as string | undefined;
  const provided = bearer || xSecret;

  if (!provided || provided !== secret) {
    error(res, 'UNAUTHORIZED', 'Invalid or missing cron secret', 401);
    return;
  }

  next();
}
