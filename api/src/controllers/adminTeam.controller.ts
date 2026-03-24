import crypto from 'crypto';
import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import { ROLE_TEMPLATES, AdminPermissions } from '../config/roleTemplates';
import { getFirebaseAuth } from '../config/firebase';
import { env } from '../config/environment';
import sgMail from '@sendgrid/mail';
import * as permissionAudit from '../services/permissionAudit.service';

if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

const PERMISSION_KEYS = [
  'can_view_customers',
  'can_view_orders',
  'can_manage_products',
  'can_manage_content',
  'can_manage_service_requests',
  'can_send_notifications',
  'can_view_analytics',
  'can_manage_subscriptions',
  'can_manage_settings',
  'can_manage_users',
] as const;

type PermissionKey = (typeof PERMISSION_KEYS)[number];

function requireCanManageUsers(req: Request, res: Response): boolean {
  const role = (req as any).adminRole as Record<string, unknown> | undefined;
  if (!role || role.can_manage_users !== true) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_users', 403);
    return false;
  }
  return true;
}

function toPermissions(role: Record<string, unknown> | null): Record<string, boolean> {
  if (!role) return {};
  const out: Record<string, boolean> = {};
  for (const k of PERMISSION_KEYS) {
    out[k] = role[k] === true;
  }
  return out;
}

/**
 * GET /admin/me - Current admin's role and permissions (all admins).
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  const adminRole = (req as any).adminRole as Record<string, unknown> | undefined;
  if (!adminRole) {
    error(res, 'FORBIDDEN', 'Admin access required', 403);
    return;
  }
  success(res, {
    role: adminRole.role || 'owner',
    ...toPermissions(adminRole),
  });
}

/**
 * GET /admin/team/audit - Recent permission changes for tenant. Requires can_manage_users.
 */
export async function getTeamAudit(req: Request, res: Response): Promise<void> {
  if (!requireCanManageUsers(req, res)) return;

  const tenantId = (req as any).tenant?.id as string;
  const limit = Math.min(parseInt((req.query.limit as string) || '20', 10) || 20, 100);

  const rows = await db('permission_audit_log')
    .where({ tenant_id: tenantId })
    .orderBy('created_at', 'desc')
    .limit(limit)
    .select('*');

  success(res, { entries: rows });
}

/**
 * GET /admin/team - List admins for tenant. Requires can_manage_users.
 */
export async function listTeam(req: Request, res: Response): Promise<void> {
  if (!requireCanManageUsers(req, res)) return;

  const tenantId = (req as any).tenant?.id as string;
  const rows = await db('admin_roles')
    .join('users', 'admin_roles.user_id', 'users.id')
    .where('admin_roles.tenant_id', tenantId)
    .whereNull('users.deleted_at')
    .select('admin_roles.*', 'users.email', 'users.first_name', 'users.last_name');

  const members = rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    userId: r.user_id,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    role: r.role,
    permissions: toPermissions(r as Record<string, unknown>),
    createdAt: r.created_at,
  }));

  success(res, { members });
}

/**
 * PUT /admin/team/:userId - Update admin role/permissions. Requires can_manage_users.
 * Cannot edit self's can_manage_users. Cannot remove own can_manage_users.
 */
export async function updateTeamMember(req: Request, res: Response): Promise<void> {
  if (!requireCanManageUsers(req, res)) return;

  const tenantId = (req as any).tenant?.id as string;
  const currentUserId = (req as any).user?.id as string;
  const targetUserId = req.params.userId;

  if (targetUserId === currentUserId) {
    error(res, 'VALIDATION_ERROR', 'Cannot edit your own permissions', 400);
    return;
  }

  const body = (req.body || {}) as { role?: string; permissions?: Partial<AdminPermissions> };
  const existing = await db('admin_roles')
    .where({ tenant_id: tenantId, user_id: targetUserId })
    .first();

  if (!existing) {
    error(res, 'NOT_FOUND', 'Admin not found for this tenant', 404);
    return;
  }

  let updates: Record<string, unknown> = { updated_at: db.fn.now() };

  if (body.role && ROLE_TEMPLATES[body.role]) {
    const template = ROLE_TEMPLATES[body.role];
    updates = { ...updates, role: body.role, ...template };
  }

  if (body.permissions && typeof body.permissions === 'object') {
    for (const k of PERMISSION_KEYS) {
      if (body.permissions[k] !== undefined) {
        if (k === 'can_manage_users' && targetUserId === currentUserId) continue;
        updates[k] = body.permissions[k] === true;
      }
    }
  }

  await db('admin_roles').where({ id: existing.id }).update(updates);

  const updated = await db('admin_roles').where({ id: existing.id }).first();
  const actorEmail = (req as any).user?.email as string | undefined;
  await permissionAudit.logPermissionChange({
    tenantId,
    actorUserId: currentUserId,
    actorEmail: actorEmail || undefined,
    action: 'admin_updated',
    targetUserId,
    targetEmail: (await db('users').where({ id: targetUserId }).first())?.email,
    changes: { before: toPermissions(existing as Record<string, unknown>), after: toPermissions(updated as Record<string, unknown>) },
  });

  success(res, {
    id: updated.id,
    userId: updated.user_id,
    role: updated.role,
    permissions: toPermissions(updated as Record<string, unknown>),
    updatedAt: updated.updated_at,
  });
}

/**
 * DELETE /admin/team/:userId - Remove admin. Requires can_manage_users. Cannot remove self.
 */
export async function removeTeamMember(req: Request, res: Response): Promise<void> {
  if (!requireCanManageUsers(req, res)) return;

  const tenantId = (req as any).tenant?.id as string;
  const currentUserId = (req as any).user?.id as string;
  const targetUserId = req.params.userId;

  if (targetUserId === currentUserId) {
    error(res, 'VALIDATION_ERROR', 'Cannot remove yourself from the team', 400);
    return;
  }

  const targetUser = await db('users').where({ id: targetUserId }).first();
  const deleted = await db('admin_roles')
    .where({ tenant_id: tenantId, user_id: targetUserId })
    .delete();

  if (deleted === 0) {
    error(res, 'NOT_FOUND', 'Admin not found for this tenant', 404);
    return;
  }

  const actorEmail = (req as any).user?.email as string | undefined;
  await permissionAudit.logPermissionChange({
    tenantId,
    actorUserId: currentUserId,
    actorEmail: actorEmail || undefined,
    action: 'admin_removed',
    targetUserId,
    targetEmail: targetUser?.email,
  });

  success(res, { removed: true }, 'Admin removed from team');
}

function getTenantDashboardUrl(slug: string): string {
  try {
    const base = env.DASHBOARD_BASE || 'https://hottubcompanion.com';
    const host = new URL(base).hostname;
    return `https://${slug}.${host}`;
  } catch {
    return `https://${slug}.hottubcompanion.com`;
  }
}

/**
 * POST /admin/team/invite - Invite an admin. Requires can_manage_users.
 */
export async function inviteTeamMember(req: Request, res: Response): Promise<void> {
  if (!requireCanManageUsers(req, res)) return;

  const tenantId = (req as any).tenant?.id as string;
  const tenant = (req as any).tenant as { slug?: string; name?: string };
  const body = (req.body || {}) as { email?: string; role?: string; permissions?: Partial<AdminPermissions> };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email) {
    error(res, 'VALIDATION_ERROR', 'Email is required', 400);
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    error(res, 'VALIDATION_ERROR', 'Invalid email format', 400);
    return;
  }

  const role = body.role && ROLE_TEMPLATES[body.role] ? body.role : 'manager';
  const template = ROLE_TEMPLATES[role];
  const permissions = { ...template, ...(body.permissions || {}) };

  const auth = getFirebaseAuth();
  let userId: string;
  let isNewUser = false;

  const existingUser = await db('users')
    .where({ tenant_id: tenantId, email })
    .whereNull('deleted_at')
    .first();

  if (existingUser) {
    userId = existingUser.id;
  } else {
    let firebaseUid: string;
    try {
      const existingFb = await auth.getUserByEmail(email);
      firebaseUid = existingFb.uid;
    } catch {
      const tempPassword = crypto.randomBytes(24).toString('base64url');
      const fbUser = await auth.createUser({
        email,
        password: tempPassword,
        emailVerified: false,
      });
      firebaseUid = fbUser.uid;
      isNewUser = true;
    }

    const [inserted] = await db('users')
      .insert({
        tenant_id: tenantId,
        firebase_uid: firebaseUid,
        email,
        role: 'customer',
      })
      .returning('*');

    userId = inserted.id;
  }

  const existingRole = await db('admin_roles')
    .where({ tenant_id: tenantId, user_id: userId })
    .first();

  if (existingRole) {
    await db('admin_roles').where({ id: existingRole.id }).update({
      role,
      ...permissions,
      updated_at: db.fn.now(),
    });
  } else {
    await db('admin_roles').insert({
      tenant_id: tenantId,
      user_id: userId,
      role,
      ...permissions,
    });
  }

  const dashboardUrl = getTenantDashboardUrl(tenant.slug || '');
  const signInUrl = `${dashboardUrl}/auth/login?redirect=${encodeURIComponent('/admin/dashboard')}`;

  if (env.SENDGRID_API_KEY) {
    try {
      let emailHtml: string;
      if (isNewUser) {
        const resetLink = await auth.generatePasswordResetLink(email, {
          url: signInUrl,
        });
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1B4D7A;">You're invited to ${tenant.name || 'Hot Tub Companion'}!</h2>
            <p>You've been invited to join the admin team. Set your password to get started:</p>
            <p style="margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #1B4D7A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Set Your Password</a>
            </p>
            <p style="color: #666; font-size: 14px;">Then sign in at: <a href="${signInUrl}">${signInUrl}</a></p>
          </div>
        `;
      } else {
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1B4D7A;">You're invited to ${tenant.name || 'Hot Tub Companion'}!</h2>
            <p>You've been added to the admin team. Sign in here:</p>
            <p style="margin: 30px 0;">
              <a href="${signInUrl}" style="background-color: #1B4D7A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Sign In</a>
            </p>
            <p style="color: #666; font-size: 14px;">Or copy: ${signInUrl}</p>
          </div>
        `;
      }
      await sgMail.send({
        to: email,
        from: { email: env.SENDGRID_FROM_EMAIL!, name: env.SENDGRID_FROM_NAME! },
        subject: `You're invited to ${tenant.name || 'Hot Tub Companion'} Admin`,
        html: emailHtml,
      });
    } catch (err: unknown) {
      console.error('Failed to send invite email:', err);
    }
  }

  const updated = await db('admin_roles').where({ tenant_id: tenantId, user_id: userId }).first();
  success(res, {
    id: updated.id,
    userId: updated.user_id,
    email,
    role: updated.role,
    permissions: toPermissions(updated as Record<string, unknown>),
    inviteSent: !!env.SENDGRID_API_KEY,
  }, 'Invite sent');

  const actorEmail = (req as any).user?.email as string | undefined;
  await permissionAudit.logPermissionChange({
    tenantId,
    actorUserId: (req as any).user?.id,
    actorEmail: actorEmail || undefined,
    action: existingRole ? 'admin_updated' : 'admin_added',
    targetUserId: userId,
    targetEmail: email,
    changes: existingRole ? { before: toPermissions(existingRole as Record<string, unknown>), after: permissions } : { after: permissions },
  });
}
