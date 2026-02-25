import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { UnauthorizedError } from '../utils/errors';
import { error } from '../utils/response';

const SKIP_PATHS = ['/health', '/api/v1/auth', '/api/v1/tenant/config'];

function shouldSkipTenant(path: string): boolean {
  return (
    path === '/health' ||
    path.startsWith('/api/v1/auth') ||
    path === '/api/v1/tenant/config' ||
    path.startsWith('/api/v1/super-admin')
  );
}

export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (shouldSkipTenant(req.path)) {
    return next();
  }

  const apiKey = req.headers['x-tenant-key'] as string | undefined;
  if (!apiKey) {
    error(res, 'UNAUTHORIZED', 'Missing x-tenant-key header', 401);
    return;
  }

  const tenant = await db('tenants').where({ api_key: apiKey, status: 'active' }).first();
  if (!tenant) {
    error(res, 'UNAUTHORIZED', 'Invalid tenant key', 401);
    return;
  }

  (req as Request & { tenant: typeof tenant }).tenant = tenant;
  next();
}
