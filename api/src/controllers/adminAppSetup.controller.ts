import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import {
  normalizeOnboardingConfig,
  type OnboardingConfigDTO,
} from '../services/onboardingConfig.service';

function requireManageSettings(req: Request, res: Response): boolean {
  const role = (req as any).adminRole as Record<string, unknown> | undefined;
  const allowed = !!role && role.can_manage_settings === true;
  if (!allowed) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_settings', 403);
    return false;
  }
  return true;
}

export async function getAppSetup(req: Request, res: Response): Promise<void> {
  if (!requireManageSettings(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  success(res, { onboarding: normalizeOnboardingConfig(tenant.onboarding_config) });
}

export async function updateAppSetup(req: Request, res: Response): Promise<void> {
  if (!requireManageSettings(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const body = req.body as { onboarding?: OnboardingConfigDTO };
  if (!body.onboarding || typeof body.onboarding !== 'object') {
    error(res, 'VALIDATION_ERROR', 'onboarding object is required', 400);
    return;
  }

  const normalized = normalizeOnboardingConfig(body.onboarding);

  await db('tenants').where({ id: tenantId }).update({
    onboarding_config: normalized,
    updated_at: db.fn.now(),
  });

  success(res, { onboarding: normalized }, 'App setup updated');
}
