import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import * as scdbService from '../services/scdb.service';
import * as notificationService from '../services/notification.service';
import { getSanitationSystemValues, isValidSanitationSystem } from '../services/sanitationSystem.service';
import * as maintenanceSchedule from '../services/maintenanceSchedule.service';

function sanitizeCustomerEntered(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ['brand', 'model', 'modelLine'] as const) {
    const v = o[key];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) out[key] = t.slice(0, 300);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function requireCustomerUser(req: Request, res: Response): string | null {
  if ((req as any).userIsTenantAdminOverride) {
    error(res, 'FORBIDDEN', 'This action requires a customer account', 403);
    return null;
  }
  const id = (req as any).user?.id as string | undefined;
  if (!id || id.startsWith('admin_')) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return null;
  }
  return id;
}

async function isBrandVisibleToTenant(brandId: string, tenantId: string): Promise<boolean> {
  const visibility = await db('tenant_brand_visibility')
    .where({ tenant_id: tenantId, brand_id: brandId })
    .first();
  if (!visibility) return true;
  return visibility.is_visible === true;
}

/**
 * POST /api/v1/consumer-uhtd-suggestions
 * Inserts a review-queue row only (no SCdb writes) and creates a spa_profile pending UHTD link.
 */
export async function submitConsumerSuggestion(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const body = req.body as {
    brandId?: string | null;
    brandName?: string | null;
    modelLineName?: string | null;
    modelName?: string | null;
    year?: number | null;
    sanitizationSystem?: string;
    customSanitizerNote?: string | null;
    serialNumber?: string | null;
    notes?: string | null;
    usageMonths?: number[] | null;
    winterStrategy?: 'shutdown' | 'operate';
    customerEntered?: { brand?: string; model?: string; modelLine?: string };
  };

  const modelName = typeof body.modelName === 'string' ? body.modelName.trim() : '';
  if (modelName.length < 1) {
    error(res, 'VALIDATION_ERROR', 'modelName is required', 400);
    return;
  }

  const brandId = body.brandId && typeof body.brandId === 'string' ? body.brandId.trim() : null;
  const brandNameRaw = typeof body.brandName === 'string' ? body.brandName.trim() : '';

  let resolvedBrandName = brandNameRaw;

  if (brandId) {
    const brandRow = await scdbService.getBrandById(brandId);
    if (!brandRow) {
      error(res, 'NOT_FOUND', 'Brand not found', 404);
      return;
    }
    const visible = await isBrandVisibleToTenant(brandId, tenantId);
    if (!visible) {
      error(res, 'FORBIDDEN', 'This brand is not available for your retailer', 403);
      return;
    }
    resolvedBrandName = brandRow.name || 'Unknown';
  } else if (brandNameRaw.length < 2) {
    error(res, 'VALIDATION_ERROR', 'brandName is required when brandId is omitted (min 2 characters)', 400);
    return;
  }

  const modelLineName = typeof body.modelLineName === 'string' ? body.modelLineName.trim() : '';
  const year =
    typeof body.year === 'number' && Number.isFinite(body.year)
      ? Math.min(2100, Math.max(0, Math.floor(body.year)))
      : 0;

  if (!body.sanitizationSystem || typeof body.sanitizationSystem !== 'string') {
    error(res, 'VALIDATION_ERROR', 'sanitizationSystem is required', 400);
    return;
  }
  if (!(await isValidSanitationSystem(body.sanitizationSystem, true))) {
    const allowed = await getSanitationSystemValues(true);
    error(res, 'VALIDATION_ERROR', `Invalid sanitizationSystem. Allowed: ${allowed.join(', ')}`, 400);
    return;
  }
  if (body.sanitizationSystem === 'other') {
    const note = typeof body.customSanitizerNote === 'string' ? body.customSanitizerNote.trim() : '';
    if (note.length < 2) {
      error(res, 'VALIDATION_ERROR', 'customSanitizerNote is required when sanitizationSystem is other', 400);
      return;
    }
  }

  const defaultMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  let usageMonthsForProfile = defaultMonths;
  if (body.usageMonths !== undefined && body.usageMonths !== null) {
    if (!Array.isArray(body.usageMonths) || body.usageMonths.some((m) => typeof m !== 'number' || m < 1 || m > 12)) {
      error(res, 'VALIDATION_ERROR', 'usageMonths must be an array of integers 1-12', 400);
      return;
    }
    usageMonthsForProfile = body.usageMonths.length > 0 ? body.usageMonths : defaultMonths;
  }

  let winterStrategy: 'shutdown' | 'operate' = 'operate';
  if (body.winterStrategy !== undefined) {
    if (body.winterStrategy !== 'shutdown' && body.winterStrategy !== 'operate') {
      error(res, 'VALIDATION_ERROR', 'winterStrategy must be shutdown or operate', 400);
      return;
    }
    winterStrategy = body.winterStrategy;
  }

  const customerEntered = sanitizeCustomerEntered(body.customerEntered);

  const payload = {
    source: 'mobile_onboarding',
    brandId,
    brandName: brandId ? resolvedBrandName : brandNameRaw,
    modelLineName: modelLineName || null,
    modelName,
    year,
    sanitizationSystem: body.sanitizationSystem,
    customSanitizerNote:
      body.sanitizationSystem === 'other'
        ? (typeof body.customSanitizerNote === 'string' ? body.customSanitizerNote.trim() : '')
        : null,
    serialNumber: typeof body.serialNumber === 'string' ? body.serialNumber.trim() || null : null,
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    customerEntered,
    usageMonths: usageMonthsForProfile,
    winterStrategy,
  };

  const trx = await db.transaction();
  try {
    const [suggestion] = await trx('consumer_uhtd_suggestions')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        status: 'pending',
        payload,
      })
      .returning('*');

    const existingCount = await trx('spa_profiles')
      .where({ user_id: userId, tenant_id: tenantId })
      .count('* as c')
      .first();
    const count = parseInt(String((existingCount as any)?.c ?? '0'), 10);
    const isPrimary = count === 0;

    const [profile] = await trx('spa_profiles')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        brand: resolvedBrandName.slice(0, 100),
        model_line: (modelLineName || '—').slice(0, 100),
        model: modelName.slice(0, 100),
        year: year === 0 ? 0 : year,
        serial_number: payload.serialNumber ? String(payload.serialNumber).slice(0, 100) : null,
        nickname: null,
        sanitization_system: body.sanitizationSystem,
        usage_months: usageMonthsForProfile,
        winter_strategy: winterStrategy,
        uhtd_spa_model_id: null,
        is_primary: isPrimary,
        consumer_suggestion_id: suggestion.id,
        uhtd_verification_status: 'pending_review',
      })
      .returning('*');

    await trx.commit();

    const spaProfileId = (profile as { id: string }).id;
    void maintenanceSchedule.regenerateAutoEventsForSpaProfile(spaProfileId).catch((err) => {
      console.warn('[consumerUhtd] maintenance schedule regenerate failed:', err);
    });

    if (isPrimary) {
      const tenant = (req as any).tenant as { name?: string } | undefined;
      const tenantName = tenant?.name ?? 'Your retailer';
      void notificationService
        .sendWelcomeNotification(userId, tenantId, tenantName, modelName)
        .catch((err) => console.warn('[consumerUhtd] welcome notification failed:', err));
    }

    res.status(201);
    success(
      res,
      {
        suggestion: {
          id: suggestion.id,
          status: suggestion.status,
          createdAt: suggestion.created_at,
        },
        spaProfile: {
          id: profile.id,
          uhtdVerificationStatus: profile.uhtd_verification_status,
          brand: profile.brand,
          model: profile.model,
          year: profile.year,
        },
      },
      'Submitted for review. Your hot tub is not in UHTD until our team verifies it.'
    );
  } catch (e) {
    await trx.rollback();
    throw e;
  }
}
