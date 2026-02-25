import { Request, Response } from 'express';
import { getConfig, getByApiKey } from '../services/tenant.service';
import { error, success } from '../utils/response';

export async function getTenantConfig(req: Request, res: Response): Promise<void> {
  const apiKey = req.headers['x-tenant-key'] as string | undefined;
  if (!apiKey) {
    error(res, 'UNAUTHORIZED', 'Missing x-tenant-key header', 401);
    return;
  }

  const tenant = await getByApiKey(apiKey);
  if (!tenant) {
    error(res, 'UNAUTHORIZED', 'Invalid tenant key', 401);
    return;
  }

  const config = await getConfig(tenant.id);
  if (!config) {
    error(res, 'NOT_FOUND', 'Tenant config not found', 404);
    return;
  }

  success(res, config);
}
