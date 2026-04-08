import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import * as waterCareService from '../services/waterCare.service';

function requireCustomerUser(req: Request, res: Response): string | null {
  if ((req as Request & { userIsTenantAdminOverride?: boolean }).userIsTenantAdminOverride) {
    error(res, 'FORBIDDEN', 'This action requires a customer account', 403);
    return null;
  }
  const user = (req as Request & { user?: { id?: string } }).user;
  if (!user?.id || user.id.startsWith('admin_')) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return null;
  }
  return user.id;
}

export async function listProfiles(_req: Request, res: Response) {
  try {
    success(res, await waterCareService.listProfiles());
  } catch (err) {
    console.error('Error listing water care profiles:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to list water care profiles', 500);
  }
}

export async function createProfile(req: Request, res: Response) {
  try {
    const { name, description, notes, isActive, measurements } = req.body;
    if (!name || !Array.isArray(measurements) || measurements.length === 0) {
      return error(res, 'VALIDATION_ERROR', 'name and at least one measurement are required', 400);
    }
    const profile = await waterCareService.createProfile({ name, description, notes, isActive, measurements });
    res.status(201);
    success(res, profile, 'Water care profile created');
  } catch (err) {
    console.error('Error creating water care profile:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to create water care profile', 500);
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const profile = await waterCareService.updateProfile(req.params.id, req.body);
    if (!profile) return error(res, 'NOT_FOUND', 'Water care profile not found', 404);
    success(res, profile, 'Water care profile updated');
  } catch (err) {
    console.error('Error updating water care profile:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to update water care profile', 500);
  }
}

export async function deleteProfile(req: Request, res: Response) {
  try {
    const deleted = await waterCareService.deleteProfile(req.params.id);
    if (!deleted) return error(res, 'NOT_FOUND', 'Water care profile not found', 404);
    success(res, { id: req.params.id }, 'Water care profile deleted');
  } catch (err) {
    console.error('Error deleting water care profile:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to delete water care profile', 500);
  }
}

export async function listMappings(_req: Request, res: Response) {
  try {
    success(res, await waterCareService.listMappings());
  } catch (err) {
    console.error('Error listing water care mappings:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to list water care mappings', 500);
  }
}

export async function createMapping(req: Request, res: Response) {
  try {
    const { scopeType, scopeId, sanitationSystemValue, profileId, priority } = req.body;
    if (!scopeType || !profileId) {
      return error(res, 'VALIDATION_ERROR', 'scopeType and profileId are required', 400);
    }
    const mapping = await waterCareService.createMapping({
      scopeType,
      scopeId,
      sanitationSystemValue,
      profileId,
      priority,
    });
    res.status(201);
    success(res, mapping, 'Water care mapping created');
  } catch (err) {
    console.error('Error creating water care mapping:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to create water care mapping', 500);
  }
}

export async function updateMapping(req: Request, res: Response) {
  try {
    const mapping = await waterCareService.updateMapping(req.params.id, req.body);
    if (!mapping) return error(res, 'NOT_FOUND', 'Water care mapping not found', 404);
    success(res, mapping, 'Water care mapping updated');
  } catch (err) {
    console.error('Error updating water care mapping:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to update water care mapping', 500);
  }
}

export async function listWaterMetrics(_req: Request, res: Response) {
  try {
    success(res, await waterCareService.listWaterMetrics());
  } catch (err) {
    console.error('Error listing water metrics:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to list water metrics', 500);
  }
}

export async function createWaterMetric(req: Request, res: Response) {
  try {
    const { metricKey, label, unit, defaultMinValue, defaultMaxValue, sortHint } = req.body ?? {};
    if (metricKey == null || label == null || unit == null || defaultMinValue === undefined || defaultMaxValue === undefined) {
      return error(
        res,
        'VALIDATION_ERROR',
        'metricKey, label, unit, defaultMinValue, and defaultMaxValue are required',
        400
      );
    }
    const created = await waterCareService.createWaterMetric({
      metricKey: String(metricKey),
      label: String(label),
      unit: String(unit),
      defaultMinValue: Number(defaultMinValue),
      defaultMaxValue: Number(defaultMaxValue),
      sortHint: sortHint !== undefined ? Number(sortHint) : undefined,
    });
    res.status(201);
    success(res, created, 'Metric created');
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'METRIC_KEY_EXISTS') {
      return error(res, 'CONFLICT', 'A metric with this key already exists', 409);
    }
    if (message === 'METRIC_KEY_REQUIRED' || message === 'METRIC_LABEL_UNIT_REQUIRED') {
      return error(res, 'VALIDATION_ERROR', message === 'METRIC_KEY_REQUIRED' ? 'metricKey is required' : 'label and unit are required', 400);
    }
    console.error('Error creating water metric:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to create water metric', 500);
  }
}

export async function updateWaterMetric(req: Request, res: Response) {
  try {
    const { label, unit, defaultMinValue, defaultMaxValue, sortHint } = req.body ?? {};
    const ok = await waterCareService.updateWaterMetric(req.params.id, {
      label,
      unit,
      defaultMinValue: defaultMinValue !== undefined ? Number(defaultMinValue) : undefined,
      defaultMaxValue: defaultMaxValue !== undefined ? Number(defaultMaxValue) : undefined,
      sortHint: sortHint !== undefined ? Number(sortHint) : undefined,
    });
    if (!ok) return error(res, 'NOT_FOUND', 'Metric not found', 404);
    success(res, { id: req.params.id }, 'Metric updated');
  } catch (err) {
    console.error('Error updating water metric:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to update water metric', 500);
  }
}

export async function deleteMapping(req: Request, res: Response) {
  try {
    const deleted = await waterCareService.deleteMapping(req.params.id);
    if (!deleted) return error(res, 'NOT_FOUND', 'Water care mapping not found', 404);
    success(res, { id: req.params.id }, 'Water care mapping deleted');
  } catch (err) {
    console.error('Error deleting water care mapping:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to delete water care mapping', 500);
  }
}

export async function getResolvedWaterCare(req: Request, res: Response) {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  try {
    const tenantId = (req as Request & { tenant?: { id?: string } }).tenant?.id;
    if (!tenantId) return error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    const resolved = await waterCareService.resolveWaterCareForSpaProfile(req.params.spaProfileId, tenantId, userId);
    if (!resolved) return error(res, 'NOT_FOUND', 'Spa profile not found', 404);
    success(res, resolved);
  } catch (err) {
    console.error('Error resolving water care:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to resolve water care', 500);
  }
}

export async function createWaterTest(req: Request, res: Response) {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  try {
    const tenantId = (req as Request & { tenant?: { id?: string } }).tenant?.id;
    if (!tenantId) return error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    const {
      spaProfileId,
      testedAt,
      notes,
      sharedWithRetailer,
      measurements,
      waterTestKitId,
      policyAcceptanceVersion,
    } = req.body ?? {};
    if (!spaProfileId || !Array.isArray(measurements)) {
      return error(res, 'VALIDATION_ERROR', 'spaProfileId and measurements are required', 400);
    }
    const created = await waterCareService.createWaterTest(tenantId, userId, {
      spaProfileId,
      testedAt,
      notes,
      sharedWithRetailer,
      waterTestKitId,
      policyAcceptanceVersion,
      measurements,
    });
    if (!created) return error(res, 'NOT_FOUND', 'Spa profile not found', 404);
    res.status(201);
    success(res, created, 'Water test logged');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to log water test';
    if (message === 'WATER_CARE_CONSENT_REQUIRED') {
      return error(res, 'CONSENT_REQUIRED', 'Accept the current water care policy before logging a test', 403);
    }
    if (message === 'INVALID_WATER_TEST_KIT') {
      return error(res, 'VALIDATION_ERROR', 'Invalid or unpublished water test kit', 400);
    }
    if (message === 'At least one valid measurement is required' || message === 'Invalid testedAt') {
      return error(res, 'VALIDATION_ERROR', message, 400);
    }
    console.error('Error creating water test:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to log water test', 500);
  }
}

export async function listWaterTests(req: Request, res: Response) {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  try {
    const tenantId = (req as Request & { tenant?: { id?: string } }).tenant?.id;
    if (!tenantId) return error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    const tests = await waterCareService.listWaterTestsForSpaProfile(req.params.spaProfileId, tenantId, userId);
    if (tests == null) return error(res, 'NOT_FOUND', 'Spa profile not found', 404);
    success(res, { tests });
  } catch (err) {
    console.error('Error listing water tests:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to list water tests', 500);
  }
}
