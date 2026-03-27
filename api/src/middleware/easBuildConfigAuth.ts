import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/environment';
import { error } from '../utils/response';

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

export function easBuildConfigAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = env.EAS_BUILD_CONFIG_SECRET;
  if (!secret || secret.length < 32) {
    error(res, 'SERVICE_UNAVAILABLE', 'EAS tenant config endpoint is not configured', 503);
    return;
  }

  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const xSecret = req.headers['x-eas-build-secret'] as string | undefined;
  const provided = bearer || xSecret;

  if (!provided || !constantTimeCompare(provided, secret)) {
    error(res, 'UNAUTHORIZED', 'Invalid or missing EAS build config secret', 401);
    return;
  }

  next();
}
