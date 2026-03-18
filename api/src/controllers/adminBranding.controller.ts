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

function mapBranding(row: any) {
  return {
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    fontFamily: row.font_family,
    logoUrl: row.logo_url,
    iconUrl: row.icon_url,
  };
}

export async function getBranding(req: Request, res: Response): Promise<void> {
  if (!requireManageSettings(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  success(res, { branding: mapBranding(tenant) });
}

export async function updateBranding(req: Request, res: Response): Promise<void> {
  if (!requireManageSettings(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const body = req.body as {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string | null;
    iconUrl?: string | null;
    accentColor?: string | null;
    fontFamily?: string | null;
  };

  const update: Record<string, unknown> = {};
  if (body.primaryColor !== undefined) update.primary_color = body.primaryColor || null;
  if (body.secondaryColor !== undefined) update.secondary_color = body.secondaryColor || null;
  if (body.logoUrl !== undefined) update.logo_url = body.logoUrl || null;
  if (body.iconUrl !== undefined) update.icon_url = body.iconUrl || null;
  if (body.accentColor !== undefined) update.accent_color = body.accentColor || null;
  if (body.fontFamily !== undefined) update.font_family = body.fontFamily || null;

  if (Object.keys(update).length === 0) {
    error(res, 'VALIDATION_ERROR', 'No branding fields provided', 400);
    return;
  }

  const [updated] = await db('tenants').where({ id: tenantId }).update(update).returning('*');
  success(res, { branding: mapBranding(updated) }, 'Branding updated');
}

