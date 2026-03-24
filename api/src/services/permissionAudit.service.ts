import { db } from '../config/database';

export type PermissionAuditAction =
  | 'admin_added'
  | 'admin_updated'
  | 'admin_removed'
  | 'platform_user_added'
  | 'platform_user_updated'
  | 'platform_user_removed';

export async function logPermissionChange(params: {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: PermissionAuditAction;
  targetUserId?: string | null;
  targetEmail?: string | null;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
}): Promise<void> {
  try {
    await db('permission_audit_log').insert({
      tenant_id: params.tenantId || null,
      actor_user_id: params.actorUserId || null,
      actor_email: params.actorEmail || null,
      action: params.action,
      target_user_id: params.targetUserId || null,
      target_email: params.targetEmail || null,
      changes: params.changes ? JSON.stringify(params.changes) : null,
    });
  } catch (err) {
    console.error('Failed to write permission audit log:', err);
  }
}
