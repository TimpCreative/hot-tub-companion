import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import * as scdbService from '../services/scdb.service';
import * as notificationService from '../services/notification.service';

const SANITIZATION_SYSTEMS = ['bromine', 'chlorine', 'frog_ease', 'copper', 'silver_mineral'] as const;

function mapProfile(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    brand: row.brand,
    modelLine: row.model_line,
    model: row.model,
    year: row.year,
    serialNumber: row.serial_number,
    nickname: row.nickname,
    sanitizationSystem: row.sanitization_system,
    usageMonths: row.usage_months,
    uhtdSpaModelId: row.uhtd_spa_model_id,
    uhtdVerificationStatus: row.uhtd_verification_status ?? 'linked',
    consumerSuggestionId: row.consumer_suggestion_id ?? null,
    isPrimary: row.is_primary,
    warrantyExpirationDate: row.warranty_expiration_date ?? null,
    lastFilterChange: row.last_filter_change ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireCustomerUser(req: Request, res: Response): string | null {
  if ((req as any).userIsTenantAdminOverride) {
    error(res, 'FORBIDDEN', 'Spa profiles require a customer account', 403);
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

export async function listSpaProfiles(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const rows = await db('spa_profiles')
    .where({ user_id: userId, tenant_id: tenantId })
    .orderBy('created_at', 'asc');

  success(res, { spaProfiles: rows.map(mapProfile) });
}

export async function createSpaProfile(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const body = req.body as {
    uhtdSpaModelId?: string;
    sanitizationSystem?: string;
    serialNumber?: string | null;
    usageMonths?: number[] | null;
    nickname?: string | null;
  };

  if (!body.uhtdSpaModelId || typeof body.uhtdSpaModelId !== 'string') {
    error(res, 'VALIDATION_ERROR', 'uhtdSpaModelId is required', 400);
    return;
  }
  if (!body.sanitizationSystem || typeof body.sanitizationSystem !== 'string') {
    error(res, 'VALIDATION_ERROR', 'sanitizationSystem is required', 400);
    return;
  }
  if (!SANITIZATION_SYSTEMS.includes(body.sanitizationSystem as (typeof SANITIZATION_SYSTEMS)[number])) {
    error(res, 'VALIDATION_ERROR', `Invalid sanitizationSystem. Allowed: ${SANITIZATION_SYSTEMS.join(', ')}`, 400);
    return;
  }

  const spaModel = await scdbService.getSpaModelById(body.uhtdSpaModelId);
  if (!spaModel || spaModel.isDiscontinued) {
    error(res, 'NOT_FOUND', 'Spa model not found', 404);
    return;
  }

  const visible = await isBrandVisibleToTenant(spaModel.brandId, tenantId);
  if (!visible) {
    error(res, 'FORBIDDEN', 'This spa model is not available for your retailer', 403);
    return;
  }

  const brandName = spaModel.brandName || '';
  const modelLineName = spaModel.modelLineName || '';
  const modelName = spaModel.name || '';
  const year = spaModel.year;

  let usageMonths = body.usageMonths;
  if (usageMonths !== undefined && usageMonths !== null) {
    if (!Array.isArray(usageMonths) || usageMonths.some((m) => typeof m !== 'number' || m < 1 || m > 12)) {
      error(res, 'VALIDATION_ERROR', 'usageMonths must be an array of integers 1-12', 400);
      return;
    }
  } else {
    usageMonths = undefined;
  }

  const existingCount = await db('spa_profiles').where({ user_id: userId, tenant_id: tenantId }).count('* as c').first();
  const count = parseInt(String((existingCount as any)?.c ?? '0'), 10);
  const isPrimary = count === 0;

  const defaultMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const [row] = await db('spa_profiles')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      brand: brandName,
      model_line: modelLineName,
      model: modelName,
      year,
      serial_number: body.serialNumber?.trim() || null,
      nickname: body.nickname?.trim() || null,
      sanitization_system: body.sanitizationSystem,
      usage_months: usageMonths ?? defaultMonths,
      uhtd_spa_model_id: body.uhtdSpaModelId,
      is_primary: isPrimary,
    })
    .returning('*');

  if (isPrimary) {
    const tenant = (req as any).tenant as { name?: string } | undefined;
    const tenantName = tenant?.name ?? 'Your retailer';
    void notificationService
      .sendWelcomeNotification(userId, tenantId, tenantName, modelName)
      .catch((err) => console.warn('[spaProfiles] welcome notification failed:', err));
  }

  res.status(201);
  success(res, { spaProfile: mapProfile(row) }, 'Spa profile created');
}

/** Updates a single spa profile (sanitization, usage months, serial, nickname, warranty, last filter change). */
export async function updateSpaProfile(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const id = req.params.id as string;
  const body = req.body as {
    sanitizationSystem?: string;
    usageMonths?: number[];
    serialNumber?: string | null;
    nickname?: string | null;
    warrantyExpirationDate?: string | null;
    lastFilterChange?: string | null;
  };

  const existing = await db('spa_profiles')
    .where({ id, user_id: userId, tenant_id: tenantId })
    .first();
  if (!existing) {
    error(res, 'NOT_FOUND', 'Spa profile not found', 404);
    return;
  }

  const update: Record<string, unknown> = { updated_at: db.fn.now() };

  if (body.sanitizationSystem !== undefined) {
    if (typeof body.sanitizationSystem !== 'string' || !SANITIZATION_SYSTEMS.includes(body.sanitizationSystem as (typeof SANITIZATION_SYSTEMS)[number])) {
      error(res, 'VALIDATION_ERROR', `Invalid sanitizationSystem. Allowed: ${SANITIZATION_SYSTEMS.join(', ')}`, 400);
      return;
    }
    update.sanitization_system = body.sanitizationSystem;
  }
  if (body.usageMonths !== undefined) {
    if (!Array.isArray(body.usageMonths) || body.usageMonths.some((m) => typeof m !== 'number' || m < 1 || m > 12)) {
      error(res, 'VALIDATION_ERROR', 'usageMonths must be an array of integers 1-12', 400);
      return;
    }
    update.usage_months = body.usageMonths;
  }
  if (body.serialNumber !== undefined) update.serial_number = body.serialNumber?.trim() || null;
  if (body.nickname !== undefined) update.nickname = body.nickname?.trim() || null;
  if (body.warrantyExpirationDate !== undefined) {
    update.warranty_expiration_date = body.warrantyExpirationDate
      ? new Date(body.warrantyExpirationDate)
      : null;
  }
  if (body.lastFilterChange !== undefined) {
    update.last_filter_change = body.lastFilterChange
      ? new Date(body.lastFilterChange)
      : null;
  }

  const [row] = await db('spa_profiles')
    .where({ id })
    .update(update)
    .returning('*');

  success(res, { spaProfile: mapProfile(row) }, 'Spa profile updated');
}

/** Deletes a single spa profile. */
export async function deleteSpaProfile(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const id = req.params.id as string;

  const deleted = await db('spa_profiles')
    .where({ id, user_id: userId, tenant_id: tenantId })
    .del();

  if (deleted === 0) {
    error(res, 'NOT_FOUND', 'Spa profile not found', 404);
    return;
  }
  success(res, { deleted: true });
}

/** Deletes all spa profiles for the current user in this tenant (e.g. QA / reset onboarding). */
export async function deleteAllSpaProfiles(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const deleted = await db('spa_profiles').where({ user_id: userId, tenant_id: tenantId }).del();
  success(res, { deletedCount: deleted });
}
