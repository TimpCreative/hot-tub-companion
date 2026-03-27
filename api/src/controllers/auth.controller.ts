import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { error, success } from '../utils/response';
import { getByApiKey } from '../services/tenant.service';

export async function register(req: Request, res: Response): Promise<void> {
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

  try {
    const result = await authService.register(tenant.id, req.body);
    success(res, result, 'Registration successful');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'VALIDATION_ERROR') {
      error(res, 'VALIDATION_ERROR', err instanceof Error ? err.message : String(err), 400);
    } else {
      throw err;
    }
  }
}

export async function login(req: Request, res: Response): Promise<void> {
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

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) {
      error(res, 'UNAUTHORIZED', 'Missing Authorization header', 401);
      return;
    }

    const user = await authService.verifyToken(token, tenant.id, {
      autoProvisionTenantUser: true,
    });
    const fcmToken = (req.body as { fcmToken?: string })?.fcmToken;
    if (fcmToken && user.id) {
      await authService.updateFcmToken(user.id as string, fcmToken);
    }
    success(res, { user });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'NOT_FOUND') {
      error(res, 'NOT_FOUND', err instanceof Error ? err.message : String(err), 404);
    } else {
      throw err;
    }
  }
}

export async function verify(req: Request, res: Response): Promise<void> {
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

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) {
    error(res, 'UNAUTHORIZED', 'Missing Authorization header', 401);
    return;
  }

  try {
    const user = await authService.verifyToken(token, tenant.id, {
      autoProvisionTenantUser: true,
    });
    success(res, { user });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'NOT_FOUND') {
      error(res, 'NOT_FOUND', err instanceof Error ? err.message : String(err), 404);
    } else {
      throw err;
    }
  }
}
