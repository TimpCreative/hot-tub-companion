import { Request, Response, NextFunction } from 'express';
import { getFirebaseAuth } from '../config/firebase';
import { db } from '../config/database';
import { error } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      tenant?: { id: string };
      user?: Record<string, unknown>;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    error(res, 'UNAUTHORIZED', 'Missing or invalid Authorization header', 401);
    return;
  }

  const token = authHeader.slice(7);
  const auth = getFirebaseAuth();

  try {
    const decoded = await auth.verifyIdToken(token);
    const tenantId = (req as Request & { tenant?: { id: string } }).tenant?.id;
    if (!tenantId) {
      error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
      return;
    }

    const user = await db('users')
      .where({ firebase_uid: decoded.uid, tenant_id: tenantId })
      .first();

    if (!user) {
      error(res, 'UNAUTHORIZED', 'User not found for this tenant', 401);
      return;
    }

    (req as Request & { user: typeof user }).user = user;
    next();
  } catch (err) {
    error(res, 'UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}
