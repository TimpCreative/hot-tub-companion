import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import {
  normalizeOnboardingConfig,
  type OnboardingConfigDTO,
} from '../services/onboardingConfig.service';
import {
  mergePartialHomeDashboard,
  normalizeHomeDashboardConfig,
  type HomeDashboardConfigDTO,
  mapDealerContact,
} from '../services/homeDashboardConfig.service';
import {
  normalizeWaterCareConfig,
  type WaterCareConfigDTO,
} from '../services/waterCareConfig.service';

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

  success(res, {
    onboarding: normalizeOnboardingConfig(tenant.onboarding_config),
    homeDashboard: normalizeHomeDashboardConfig(tenant.home_dashboard_config),
    waterCare: normalizeWaterCareConfig((tenant as { water_care_config?: unknown }).water_care_config),
    dealerContact: mapDealerContact(tenant),
    legal: {
      termsUrl: (tenant as any).terms_url?.trim() || null,
      privacyUrl: (tenant as any).privacy_url?.trim() || null,
    },
  });
}

export async function updateAppSetup(req: Request, res: Response): Promise<void> {
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

  const body = req.body as {
    onboarding?: OnboardingConfigDTO;
    homeDashboard?: HomeDashboardConfigDTO;
    waterCare?: WaterCareConfigDTO;
    dealerContact?: { phone?: string | null; address?: string | null };
    legal?: { termsUrl?: string | null; privacyUrl?: string | null };
  };

  const hasOnboarding = body.onboarding && typeof body.onboarding === 'object';
  const hasHome = body.homeDashboard && typeof body.homeDashboard === 'object';
  const hasDealer =
    body.dealerContact &&
    typeof body.dealerContact === 'object' &&
    (body.dealerContact.phone !== undefined || body.dealerContact.address !== undefined);
  const hasLegal =
    body.legal &&
    typeof body.legal === 'object' &&
    (body.legal.termsUrl !== undefined || body.legal.privacyUrl !== undefined);

  const hasWaterCare = body.waterCare && typeof body.waterCare === 'object';

  if (!hasOnboarding && !hasHome && !hasDealer && !hasLegal && !hasWaterCare) {
    error(res, 'VALIDATION_ERROR', 'Provide onboarding, homeDashboard, waterCare, dealerContact, and/or legal', 400);
    return;
  }

  const update: Record<string, unknown> = { updated_at: db.fn.now() };

  if (hasOnboarding) {
    update.onboarding_config = normalizeOnboardingConfig(body.onboarding);
  }
  if (hasHome) {
    const currentHd = normalizeHomeDashboardConfig(tenant.home_dashboard_config);
    update.home_dashboard_config = mergePartialHomeDashboard(currentHd, body.homeDashboard);
  }
  if (hasWaterCare) {
    update.water_care_config = normalizeWaterCareConfig(body.waterCare);
  }
  if (hasDealer) {
    const dc = body.dealerContact!;
    if (dc.phone !== undefined) {
      const p = dc.phone === null || dc.phone === '' ? null : String(dc.phone).trim().slice(0, 40);
      update.public_contact_phone = p;
    }
    if (dc.address !== undefined) {
      const a =
        dc.address === null || dc.address === '' ? null : String(dc.address).trim().slice(0, 2000);
      update.public_contact_address = a;
    }
  }
  if (hasLegal) {
    const legal = body.legal!;
    if (legal.termsUrl !== undefined) {
      update.terms_url = legal.termsUrl === null || legal.termsUrl === '' ? null : String(legal.termsUrl).trim().slice(0, 2000);
    }
    if (legal.privacyUrl !== undefined) {
      update.privacy_url = legal.privacyUrl === null || legal.privacyUrl === '' ? null : String(legal.privacyUrl).trim().slice(0, 2000);
    }
  }

  await db('tenants').where({ id: tenantId }).update(update);

  const next = await db('tenants').where({ id: tenantId }).first();
  success(
    res,
    {
      onboarding: normalizeOnboardingConfig(next!.onboarding_config),
      homeDashboard: normalizeHomeDashboardConfig(next!.home_dashboard_config),
      waterCare: normalizeWaterCareConfig((next as { water_care_config?: unknown }).water_care_config),
      dealerContact: mapDealerContact(next!),
      legal: {
        termsUrl: (next as any).terms_url?.trim() || null,
        privacyUrl: (next as any).privacy_url?.trim() || null,
      },
    },
    'App setup updated'
  );
}
