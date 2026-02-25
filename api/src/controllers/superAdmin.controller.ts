import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export async function listTenants(_req: Request, res: Response): Promise<void> {
  const tenants = await db('tenants').select('*').orderBy('name');
  const formatted = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    apiKey: t.api_key,
    primaryColor: t.primary_color,
    secondaryColor: t.secondary_color,
    createdAt: t.created_at,
  }));
  success(res, { tenants: formatted });
}

export async function createTenant(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    name: string;
    slug: string;
    apiKey?: string;
    primaryColor?: string;
    secondaryColor?: string;
    status?: string;
  };

  if (!body.name || !body.slug) {
    error(res, 'VALIDATION_ERROR', 'Name and slug are required', 400);
    return;
  }

  const apiKey = body.apiKey || `tenant_${crypto.randomBytes(16).toString('hex')}`;
  const apiKeyHash = bcrypt.hashSync(apiKey, 10);

  const [tenant] = await db('tenants')
    .insert({
      name: body.name,
      slug: body.slug,
      api_key: apiKey,
      api_key_hash: apiKeyHash,
      primary_color: body.primaryColor || '#1B4D7A',
      secondary_color: body.secondaryColor || '#E8A832',
      status: body.status || 'onboarding',
    })
    .returning('*');

  res.status(201);
  success(res, {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      apiKey,
    },
  });
}
