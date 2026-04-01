import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import * as contentService from '../services/content.service';

function requireManageSettings(req: Request, res: Response): string | null {
  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return null;
  }
  const role = (req as any).adminRole as Record<string, unknown> | undefined;
  const allowed = !!role && role.can_manage_settings === true;
  if (!allowed) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_settings', 403);
    return null;
  }
  return tenantId;
}

function parseContentType(value: unknown) {
  return value === 'article' || value === 'video' ? value : null;
}

function parseVideoFormat(value: unknown) {
  return value === 'masterclass' || value === 'clip' ? value : null;
}

function parseStatus(value: unknown) {
  return value === 'draft' || value === 'published' || value === 'archived' ? value : null;
}

export async function listContent(req: Request, res: Response) {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  try {
    const items = await contentService.listRetailerContent({
      tenantId,
      includeUniversal: req.query.includeUniversal === 'true',
      search: typeof req.query.search === 'string' ? req.query.search : null,
      category: typeof req.query.category === 'string' ? req.query.category : null,
      contentType: parseContentType(req.query.type),
      videoFormat: parseVideoFormat(req.query.format),
      status: parseStatus(req.query.status),
    });
    success(res, items);
  } catch (err) {
    console.error('Error listing retailer content:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to list content', 500);
  }
}

export async function createContent(req: Request, res: Response) {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  try {
    const item = await contentService.createRetailerContent(tenantId, req.body);
    res.status(201);
    success(res, item, 'Content created');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create content';
    if (/required|Unknown category|already exists/i.test(message)) {
      return error(res, 'VALIDATION_ERROR', message, 400);
    }
    console.error('Error creating retailer content:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to create content', 500);
  }
}

export async function updateContent(req: Request, res: Response) {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  try {
    const item = await contentService.updateRetailerContent(tenantId, req.params.id, req.body);
    if (!item) return error(res, 'NOT_FOUND', 'Content not found', 404);
    success(res, item, 'Content updated');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update content';
    if (/required|Unknown category|already exists/i.test(message)) {
      return error(res, 'VALIDATION_ERROR', message, 400);
    }
    console.error('Error updating retailer content:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to update content', 500);
  }
}

export async function deleteContent(req: Request, res: Response) {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  try {
    const deleted = await contentService.deleteRetailerContent(tenantId, req.params.id);
    if (!deleted) return error(res, 'NOT_FOUND', 'Content not found', 404);
    success(res, { id: req.params.id }, 'Content deleted');
  } catch (err) {
    console.error('Error deleting retailer content:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to delete content', 500);
  }
}

export async function setSuppression(req: Request, res: Response) {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  try {
    const suppressed = !!req.body?.suppressed;
    const updated = await contentService.setTenantSuppression(tenantId, req.params.id, suppressed);
    if (!updated) return error(res, 'NOT_FOUND', 'Universal content not found', 404);
    success(res, { id: req.params.id, suppressed }, suppressed ? 'Content suppressed' : 'Content unsuppressed');
  } catch (err) {
    console.error('Error suppressing universal content:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to update suppression', 500);
  }
}
