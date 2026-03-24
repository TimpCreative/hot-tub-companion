import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import * as usersService from '../services/users.service';
import * as authService from '../services/auth.service';

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

  const body = (req.body || {}) as { fcmToken?: string | null };
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

  try {
    await authService.updateFcmToken(userId, fcmToken);
    success(res, { updated: true }, 'FCM token updated');
  } catch (err) {
    throw err;
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
