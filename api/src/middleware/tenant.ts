import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { error } from '../utils/response';

function matchesPath(path: string, target: string): boolean {
  return path === target || path.startsWith(`${target}/`);
}

function shouldSkipTenant(path: string): boolean {
  const normalized = path.startsWith('/api/v1/') ? path.slice('/api/v1'.length) : path;

  return (
    matchesPath(path, '/docs') ||
    matchesPath(normalized, '/docs') ||
    path === '/health' ||
    normalized === '/health' ||
    matchesPath(path, '/api/v1/auth') ||
    matchesPath(normalized, '/auth') ||
    path === '/api/v1/tenant/config' ||
    normalized === '/tenant/config' ||
    path === '/api/v1/internal/eas-tenant-config' ||
    normalized === '/internal/eas-tenant-config' ||
    matchesPath(path, '/api/v1/media') ||
    matchesPath(normalized, '/media') ||
    matchesPath(path, '/api/v1/super-admin') ||
    matchesPath(normalized, '/super-admin') ||
    matchesPath(path, '/api/v1/internal/cron') ||
    matchesPath(normalized, '/internal/cron') ||
    matchesPath(path, '/api/v1/webhooks') ||
    matchesPath(normalized, '/webhooks')
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
