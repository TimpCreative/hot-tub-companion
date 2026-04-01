import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import {
  getTenantPosSummary,
  testTenantPosConnection,
  updateTenantPosConfig,
} from '../services/tenantPosConfig.service';

function requireManageSettings(req: Request, res: Response): string | null {
  const role = (req as any).adminRole as Record<string, unknown> | undefined;
  const allowed = !!role && role.can_manage_settings === true;
  if (!allowed) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_settings', 403);
    return null;
  }

  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return null;
  }
  return tenantId;
}

export async function getPosConfig(req: Request, res: Response): Promise<void> {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  const summary = await getTenantPosSummary(tenantId);
  if (!summary) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  success(res, summary);
}

export async function updatePosConfig(req: Request, res: Response): Promise<void> {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  const {
    posType,
    shopifyStoreUrl,
    shopifyStorefrontToken,
    shopifyAdminToken,
  } = req.body as {
    posType?: string | null;
    shopifyStoreUrl?: string | null;
    shopifyStorefrontToken?: string | null;
    shopifyAdminToken?: string | null;
  };

  try {
    const summary = await updateTenantPosConfig(tenantId, {
      posType,
      shopifyStoreUrl,
      shopifyStorefrontToken,
      shopifyAdminToken,
    });
    success(res, summary, 'POS configuration saved');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update POS configuration';
    if (message === 'Tenant not found') {
      error(res, 'NOT_FOUND', message, 404);
      return;
    }
    if (message === 'Unsupported POS type for this phase') {
      error(res, 'VALIDATION_ERROR', message, 400);
      return;
    }
    error(res, 'INTERNAL_ERROR', message, 500);
  }
}

export async function testPosConnection(req: Request, res: Response): Promise<void> {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  try {
    const result = await testTenantPosConnection(tenantId);
    success(res, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to test POS connection';
    if (message === 'Tenant not found') {
      error(res, 'NOT_FOUND', message, 404);
      return;
    }
    if (message === 'No POS adapter configured for this tenant') {
      error(res, 'CONFIG_ERROR', message, 400);
      return;
    }
    error(res, 'INTERNAL_ERROR', message, 500);
  }
}
