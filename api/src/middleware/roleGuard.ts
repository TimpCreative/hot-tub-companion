import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { error } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      adminRole?: Record<string, unknown>;
    }
  }
}

export async function adminRoleGuard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = (req as Request & { user?: { id: string } }).user;
  const tenant = (req as Request & { tenant?: { id: string } }).tenant;

  if (!user || !tenant) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return;
  }

  // Whitelisted override (see authMiddleware): allow global tenant admins/super-admins
  // to access tenant admin routes without requiring an admin_roles row.
  if ((req as any).userIsTenantAdminOverride) {
    // Attach a permissive adminRole so downstream controllers can enforce permissions uniformly.
    (req as any).adminRole = {
      user_id: user.id,
      tenant_id: tenant.id,
      can_manage_products: true,
      can_manage_uhtd: true,
      can_manage_settings: true,
      can_manage_users: true,
      can_view_audit_log: true,
    };
    next();
    return;
  }

  const adminRole = await db('admin_roles')
    .where({ user_id: user.id, tenant_id: tenant.id })
    .first();

  if (!adminRole) {
    error(res, 'FORBIDDEN', 'Admin access required', 403);
    return;
  }

  (req as Request & { adminRole: typeof adminRole }).adminRole = adminRole;
  next();
}
