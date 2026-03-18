import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';

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

export async function getTenantBranding(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const tenant = await db('tenants').where({ id }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  success(res, { tenantId: tenant.id, branding: mapBranding(tenant) });
}

export async function updateTenantBranding(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const {
    primaryColor,
    secondaryColor,
    accentColor,
    fontFamily,
    logoUrl,
    iconUrl,
  } = req.body as {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string | null;
    fontFamily?: string | null;
    logoUrl?: string | null;
    iconUrl?: string | null;
  };

  const tenant = await db('tenants').where({ id }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  const update: Record<string, unknown> = {};
  if (primaryColor !== undefined) update.primary_color = primaryColor || null;
  if (secondaryColor !== undefined) update.secondary_color = secondaryColor || null;
  if (accentColor !== undefined) update.accent_color = accentColor || null;
  if (fontFamily !== undefined) update.font_family = fontFamily || null;
  if (logoUrl !== undefined) update.logo_url = logoUrl || null;
  if (iconUrl !== undefined) update.icon_url = iconUrl || null;

  if (Object.keys(update).length === 0) {
    error(res, 'VALIDATION_ERROR', 'No branding fields provided', 400);
    return;
  }

  const [updated] = await db('tenants').where({ id }).update(update).returning('*');
  success(res, { tenantId: updated.id, branding: mapBranding(updated) }, 'Branding updated');
}

