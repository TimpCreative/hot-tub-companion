import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import * as contentService from '../services/content.service';

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
  try {
    const items = await contentService.listSuperAdminContent({
      search: typeof req.query.search === 'string' ? req.query.search : null,
      category: typeof req.query.category === 'string' ? req.query.category : null,
      contentType: parseContentType(req.query.type),
      videoFormat: parseVideoFormat(req.query.format),
      status: parseStatus(req.query.status),
      scope:
        req.query.scope === 'universal' || req.query.scope === 'retailer' || req.query.scope === 'all'
          ? req.query.scope
          : 'all',
    });
    success(res, items);
  } catch (err) {
    console.error('Error listing super admin content:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to list content', 500);
  }
}

export async function createContent(req: Request, res: Response) {
  try {
    const item = await contentService.createSuperAdminContent(req.body);
    res.status(201);
    success(res, item, 'Content created');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create content';
    if (/required|Unknown category|already exists/i.test(message)) {
      return error(res, 'VALIDATION_ERROR', message, 400);
    }
    console.error('Error creating super admin content:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to create content', 500);
  }
}

export async function updateContent(req: Request, res: Response) {
  try {
    const item = await contentService.updateSuperAdminContent(req.params.id, req.body);
    if (!item) return error(res, 'NOT_FOUND', 'Content not found', 404);
    success(res, item, 'Content updated');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update content';
    if (/required|Unknown category|already exists/i.test(message)) {
      return error(res, 'VALIDATION_ERROR', message, 400);
    }
    console.error('Error updating super admin content:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to update content', 500);
  }
}

export async function deleteContent(req: Request, res: Response) {
  try {
    const deleted = await contentService.deleteSuperAdminContent(req.params.id);
    if (!deleted) return error(res, 'NOT_FOUND', 'Content not found', 404);
    success(res, { id: req.params.id }, 'Content deleted');
  } catch (err) {
    console.error('Error deleting super admin content:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to delete content', 500);
  }
}

export async function listCategories(_req: Request, res: Response) {
  try {
    success(res, await contentService.listCategories());
  } catch (err) {
    console.error('Error listing content categories:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to list categories', 500);
  }
}

export async function createCategory(req: Request, res: Response) {
  try {
    const category = await contentService.createCategory({
      key: String(req.body?.key ?? ''),
      label: String(req.body?.label ?? ''),
    });
    res.status(201);
    success(res, category, 'Category created');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create category';
    if (/required|exists/i.test(message)) {
      return error(res, 'VALIDATION_ERROR', message, 400);
    }
    console.error('Error creating content category:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to create category', 500);
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const category = await contentService.updateCategory(req.params.id, {
      key: req.body?.key,
      label: req.body?.label,
    });
    if (!category) return error(res, 'NOT_FOUND', 'Category not found', 404);
    success(res, category, 'Category updated');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update category';
    if (/required|exists/i.test(message)) {
      return error(res, 'VALIDATION_ERROR', message, 400);
    }
    console.error('Error updating content category:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to update category', 500);
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    const deleted = await contentService.deleteCategory(req.params.id);
    if (!deleted) return error(res, 'NOT_FOUND', 'Category not found', 404);
    success(res, { id: req.params.id }, 'Category deleted');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete category';
    if (/still assigned/i.test(message)) {
      return error(res, 'VALIDATION_ERROR', message, 400);
    }
    console.error('Error deleting content category:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to delete category', 500);
  }
}
