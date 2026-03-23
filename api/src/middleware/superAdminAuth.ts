import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getFirebaseAuth } from '../config/firebase';
import { env } from '../config/environment';
import { error } from '../utils/response';

const DEBUG_LOG = (data: Record<string, unknown>) => {
  // #region agent log
  try {
    const logPath = path.join(__dirname, '..', '..', '..', '.cursor', 'debug-97b103.log');
    fs.appendFileSync(logPath, JSON.stringify({ sessionId: '97b103', ...data, timestamp: Date.now() }) + '\n');
  } catch {
    /* ignore */
  }
  // #endregion
};

export async function superAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const raw = req.headers.authorization || req.headers['x-authorization'];
  const authHeader = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const hasToken = !!authHeader?.startsWith('Bearer ');
  DEBUG_LOG({
    hypothesisId: 'H2',
    location: 'api:superAdminAuth:entry',
    message: 'Super admin auth received',
    data: { hasToken, tokenLen: authHeader ? authHeader.length : 0 },
  });
  if (!hasToken) {
    error(res, 'UNAUTHORIZED', 'Missing or invalid Authorization header', 401);
    return;
  }

  const token = authHeader.slice(7);
  const auth = getFirebaseAuth();

  try {
    const decoded = await auth.verifyIdToken(token);
    const email = decoded.email as string;
    const allowed = env.SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase());
    if (!email || !allowed.includes(email.toLowerCase())) {
      error(res, 'FORBIDDEN', 'Super admin access required', 403);
      return;
    }
    (req as Request & { superAdminEmail: string }).superAdminEmail = email;
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token verification failed';
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    DEBUG_LOG({
      hypothesisId: 'H2',
      location: 'api:superAdminAuth:catch',
      message: 'Firebase verifyIdToken failed',
      data: { msg, code },
    });
    console.warn('Super admin auth failed:', { message: msg, code, error: String(err) });
    error(res, 'UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}
