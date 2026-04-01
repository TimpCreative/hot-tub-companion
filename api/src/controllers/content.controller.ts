import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import * as contentService from '../services/content.service';

function requireCustomerUser(req: Request, res: Response): string | null {
  if ((req as Request & { userIsTenantAdminOverride?: boolean }).userIsTenantAdminOverride) {
    error(res, 'FORBIDDEN', 'This action requires a customer account', 403);
    return null;
  }
  const user = (req as Request & { user?: { id?: string } }).user;
  if (!user?.id || user.id.startsWith('admin_')) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return null;
  }
  return user.id;
}

function parseContentType(value: unknown) {
  return value === 'article' || value === 'video' ? value : null;
}

export async function listCategories(_req: Request, res: Response) {
  try {
    success(res, await contentService.listCategories());
  } catch (err) {
    console.error('Error listing content categories:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to list content categories', 500);
  }
}

export async function listCustomerContent(req: Request, res: Response) {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;
  const tenantId = (req as Request & { tenant?: { id?: string } }).tenant?.id;
  if (!tenantId) return error(res, 'UNAUTHORIZED', 'Tenant context required', 401);

  try {
    const items = await contentService.listCustomerContent({
      tenantId,
      userId,
      spaProfileId: typeof req.query.spaProfileId === 'string' ? req.query.spaProfileId : null,
      category: typeof req.query.category === 'string' ? req.query.category : null,
      contentType: parseContentType(req.query.type),
      search: typeof req.query.search === 'string' ? req.query.search : null,
    });
    success(res, items);
  } catch (err) {
    console.error('Error listing customer content:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to list content', 500);
  }
}

export async function getCustomerContent(req: Request, res: Response) {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;
  const tenantId = (req as Request & { tenant?: { id?: string } }).tenant?.id;
  if (!tenantId) return error(res, 'UNAUTHORIZED', 'Tenant context required', 401);

  try {
    const item = await contentService.getCustomerContentById({
      id: req.params.id,
      tenantId,
      userId,
      spaProfileId: typeof req.query.spaProfileId === 'string' ? req.query.spaProfileId : null,
    });
    if (!item) return error(res, 'NOT_FOUND', 'Content not found', 404);
    success(res, item);
  } catch (err) {
    console.error('Error getting customer content:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to load content', 500);
  }
}
