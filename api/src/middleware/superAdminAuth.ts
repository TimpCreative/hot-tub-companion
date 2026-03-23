import { Request, Response, NextFunction } from 'express';
import { getFirebaseAuth } from '../config/firebase';
import { env } from '../config/environment';
import { error } from '../utils/response';

export async function superAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization || req.headers['x-authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    error(res, 'UNAUTHORIZED', 'Missing or invalid Authorization header', 401);
    return;
  }

  const token = authHeader.slice(7);
  const auth = getFirebaseAuth();

  try {
    const decoded = await auth.verifyIdToken(token);
    const email = decoded.email as string;
    if (!email || !env.SUPER_ADMIN_EMAILS.includes(email)) {
      error(res, 'FORBIDDEN', 'Super admin access required', 403);
      return;
    }
    (req as Request & { superAdminEmail: string }).superAdminEmail = email;
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token verification failed';
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    console.warn('Super admin auth failed:', { message: msg, code, error: String(err) });
    error(res, 'UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}
