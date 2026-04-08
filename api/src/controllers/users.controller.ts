import { Request, Response } from 'express';
import Expo from 'expo-server-sdk';
import { error, success } from '../utils/response';
import * as usersService from '../services/users.service';
import * as authService from '../services/auth.service';
import * as notificationSecurityAudit from '../services/notificationSecurityAudit.service';
import * as waterCareConsent from '../services/waterCareConsent.service';

function requireCustomerUser(req: Request, res: Response): string | null {
  if ((req as any).userIsTenantAdminOverride) {
    error(res, 'FORBIDDEN', 'Profile endpoints require a customer account', 403);
    return null;
  }
  const id = (req as any).user?.id as string | undefined;
  if (!id || id.startsWith('admin_')) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return null;
  }
  return id;
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  try {
    const profile = await usersService.getProfile(userId, tenantId);
    success(res, profile);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'NOT_FOUND') {
      error(res, 'NOT_FOUND', err instanceof Error ? err.message : String(err), 404);
    } else {
      throw err;
    }
  }
}

export async function putMe(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const body = req.body as usersService.ProfileUpdateBody;

  try {
    const profile = await usersService.updateProfile(userId, tenantId, body);
    success(res, profile, 'Profile updated');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'NOT_FOUND') {
      error(res, 'NOT_FOUND', err instanceof Error ? err.message : String(err), 404);
    } else {
      throw err;
    }
  }
}

export async function putFcmToken(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const body = (req.body || {}) as {
    fcmToken?: string | null;
    timezone?: string | null;
    tokenProvider?: string | null;
    tokenStatus?: string | null;
    tokenError?: string | null;
  };
  let fcmToken: string | null = null;
  if (body.fcmToken != null) {
    if (typeof body.fcmToken !== 'string') {
      error(res, 'VALIDATION_ERROR', 'fcmToken must be a string or null', 400);
      return;
    }
    const trimmed = body.fcmToken.trim();
    if (trimmed.length > 500) {
      error(res, 'VALIDATION_ERROR', 'fcmToken must be at most 500 characters', 400);
      return;
    }
    fcmToken = trimmed || null;
  }
  const tokenProvider = typeof body.tokenProvider === 'string' ? body.tokenProvider.trim().slice(0, 30) : null;
  const tokenStatus = typeof body.tokenStatus === 'string' ? body.tokenStatus.trim().slice(0, 30) : null;
  const tokenError = typeof body.tokenError === 'string' ? body.tokenError.trim().slice(0, 300) : null;

  if (fcmToken) {
    const looksLikeFcm = fcmToken.includes(':') && fcmToken.length >= 100;
    if (!Expo.isExpoPushToken(fcmToken) && !looksLikeFcm) {
      error(res, 'VALIDATION_ERROR', 'fcmToken must be an Expo push token or FCM registration token', 400);
      return;
    }
  }

  const timezone = body.timezone != null ? (typeof body.timezone === 'string' ? body.timezone : null) : undefined;

  try {
    await authService.updateFcmToken(userId, fcmToken, timezone, {
      tokenProvider,
      tokenStatus,
      tokenError,
    });
    await notificationSecurityAudit.logNotificationSecurityEvent({
      tenantId: (req as any).tenant?.id as string,
      actorUserId: userId,
      actorEmail: (req as any).user?.email as string | undefined,
      actorRole: 'customer',
      eventType: 'token_update',
      outcome: 'success',
      ...notificationSecurityAudit.requestAuditContext(req),
      details: {
        hasToken: !!fcmToken,
        tokenProvider,
        tokenStatus,
      },
    });
    success(res, { updated: true }, 'FCM token updated');
  } catch (err) {
    throw err;
  }
}

export async function getWaterCareConsent(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;
  const tenantId = (req as any).tenant?.id as string;
  try {
    const status = await waterCareConsent.getConsentStatusForUser(userId, tenantId);
    success(res, status);
  } catch (err) {
    console.error('getWaterCareConsent', err);
    error(res, 'INTERNAL_ERROR', 'Failed to load consent status', 500);
  }
}

export async function postWaterCareConsent(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;
  const tenantId = (req as any).tenant?.id as string;
  const body = (req.body || {}) as { policyVersion?: string; spaProfileId?: string | null };
  const policyVersion = (body.policyVersion ?? '').trim();
  if (!policyVersion) {
    error(res, 'VALIDATION_ERROR', 'policyVersion is required', 400);
    return;
  }
  try {
    const status = await waterCareConsent.getConsentStatusForUser(userId, tenantId);
    if (policyVersion !== status.policyVersion) {
      error(res, 'VALIDATION_ERROR', 'policyVersion does not match the tenant active policy', 400);
      return;
    }
    if (await waterCareConsent.hasAcceptedCurrentPolicy(userId, tenantId, policyVersion)) {
      success(res, { accepted: true, policyVersion }, 'Consent already recorded');
      return;
    }
    await waterCareConsent.recordConsent({
      userId,
      tenantId,
      policyVersion,
      spaProfileId: body.spaProfileId ?? null,
    });
    success(res, { accepted: true, policyVersion }, 'Consent recorded');
  } catch (err: unknown) {
    console.error('postWaterCareConsent', err);
    error(res, 'INTERNAL_ERROR', 'Failed to record consent', 500);
  }
}

export async function deleteMe(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const body = (req.body || {}) as { hardDelete?: boolean };
  const hardDelete = body.hardDelete === true;

  try {
    await usersService.deleteAccount(userId, tenantId, hardDelete);
    success(res, { deleted: true, hardDelete }, 'Account deleted');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'NOT_FOUND') {
      error(res, 'NOT_FOUND', err instanceof Error ? err.message : String(err), 404);
    } else {
      throw err;
    }
  }
}
