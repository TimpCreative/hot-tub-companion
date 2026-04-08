import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';

function requireManageSettings(req: Request, res: Response): boolean {
  const role = (req as any).adminRole as Record<string, unknown> | undefined;
  const allowed = !!role && role.can_manage_settings === true;
  if (!allowed) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_settings', 403);
    return false;
  }
  return true;
}

/** WC-8: lightweight aggregate counts for retailer visibility (expand later). */
export async function getWaterCareAnalytics(req: Request, res: Response): Promise<void> {
  if (!requireManageSettings(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const totalRow = await db('water_tests').where({ tenant_id: tenantId }).count('* as count');
  const withKitRow = await db('water_tests')
    .where({ tenant_id: tenantId })
    .whereNotNull('water_test_kit_id')
    .count('* as count');

  const total = Number((totalRow[0] as { count?: string })?.count ?? 0);
  const withKit = Number((withKitRow[0] as { count?: string })?.count ?? 0);

  success(res, {
    totalWaterTests: total,
    testsWithKitSelected: withKit,
    testsWithoutKit: Math.max(0, total - withKit),
  });
}
