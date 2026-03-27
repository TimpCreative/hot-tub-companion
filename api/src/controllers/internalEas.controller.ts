import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';

export async function getEasTenantConfig(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
    if (!slug) {
      error(res, 'VALIDATION_ERROR', 'Query parameter slug is required', 400);
      return;
    }

    const tenant = await db('tenants').where({ slug, status: 'active' }).first();
    if (!tenant) {
      error(res, 'NOT_FOUND', 'No active tenant for slug', 404);
      return;
    }

    success(res, { tenantApiKey: tenant.api_key as string });
  } catch (err) {
    next(err);
  }
}
