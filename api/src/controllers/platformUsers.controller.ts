import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import * as permissionAudit from '../services/permissionAudit.service';

/**
 * GET /super-admin/platform-users - List platform users.
 */
export async function listPlatformUsers(req: Request, res: Response): Promise<void> {
  const rows = await db('platform_users').orderBy('created_at', 'desc');
  success(res, { users: rows });
}

/**
 * POST /super-admin/platform-users - Add platform user.
 */
export async function addPlatformUser(req: Request, res: Response): Promise<void> {
  const email = (req as Request & { superAdminEmail: string }).superAdminEmail;
  const body = (req.body || {}) as {
    email?: string;
    platform_role?: string;
    tenant_scope?: string[] | null;
  };

  const targetEmail = (body.email || '').trim().toLowerCase();
  if (!targetEmail) {
    error(res, 'VALIDATION_ERROR', 'Email is required', 400);
    return;
  }

  const role = body.platform_role === 'tenant_admin' ? 'tenant_admin' : 'super_admin';
  const tenantScope = Array.isArray(body.tenant_scope) ? body.tenant_scope : null;

  try {
    const [inserted] = await db('platform_users')
      .insert({
        email: targetEmail,
        platform_role: role,
        tenant_scope: tenantScope ? JSON.stringify(tenantScope) : null,
        added_by: email,
        updated_at: db.fn.now(),
      })
      .returning('*');

    await permissionAudit.logPermissionChange({
      actorEmail: email,
      action: 'platform_user_added',
      targetEmail: targetEmail,
      changes: { after: { platform_role: role, tenant_scope: tenantScope } },
    });
    success(res, inserted, 'Platform user added');
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      error(res, 'CONFLICT', 'This email is already a platform user', 409);
      return;
    }
    throw err;
  }
}

/**
 * PUT /super-admin/platform-users/:id - Update platform user.
 */
export async function updatePlatformUser(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  const body = (req.body || {}) as {
    platform_role?: string;
    tenant_scope?: string[] | null;
  };

  const existing = await db('platform_users').where({ id }).first();
  if (!existing) {
    error(res, 'NOT_FOUND', 'Platform user not found', 404);
    return;
  }

  const updates: Record<string, unknown> = { updated_at: db.fn.now() };
  if (body.platform_role === 'tenant_admin' || body.platform_role === 'super_admin') {
    updates.platform_role = body.platform_role;
  }
  if (body.tenant_scope !== undefined) {
    updates.tenant_scope = Array.isArray(body.tenant_scope) ? JSON.stringify(body.tenant_scope) : null;
  }

  await db('platform_users').where({ id }).update(updates);
  const updated = await db('platform_users').where({ id }).first();
  const actorEmail = (req as Request & { superAdminEmail?: string }).superAdminEmail;
  await permissionAudit.logPermissionChange({
    actorEmail: actorEmail || undefined,
    action: 'platform_user_updated',
    targetEmail: existing.email,
    changes: { before: existing, after: updated },
  });
  success(res, updated, 'Platform user updated');
}

/**
 * DELETE /super-admin/platform-users/:id - Remove platform user.
 */
export async function removePlatformUser(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  const existing = await db('platform_users').where({ id }).first();
  if (!existing) {
    error(res, 'NOT_FOUND', 'Platform user not found', 404);
    return;
  }
  await db('platform_users').where({ id }).delete();
  const actorEmail = (req as Request & { superAdminEmail?: string }).superAdminEmail;
  await permissionAudit.logPermissionChange({
    actorEmail: actorEmail || undefined,
    action: 'platform_user_removed',
    targetEmail: existing.email,
  });
  success(res, { removed: true }, 'Platform user removed');
}
