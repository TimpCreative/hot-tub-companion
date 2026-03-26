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

  const body = (req.body || {}) as { fcmToken?: string | null; timezone?: string | null };
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

  const timezone = body.timezone != null ? (typeof body.timezone === 'string' ? body.timezone : null) : undefined;

  try {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a47da7ba-8944-40d5-a7b1-3ca8dd181a2c', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '8c62d1',
      },
      body: JSON.stringify({
        sessionId: '8c62d1',
        runId: 'pre-fix',
        hypothesisId: 'H2-H3',
        location: 'api/src/controllers/users.controller.ts:76',
        message: 'Received token update request',
        data: {
          userId,
          tokenLength: fcmToken?.length ?? 0,
          tokenPrefix: fcmToken ? fcmToken.slice(0, 12) : null,
          timezone,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    await authService.updateFcmToken(userId, fcmToken, timezone);
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
