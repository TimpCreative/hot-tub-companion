import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import * as waterTestKitsService from '../services/waterTestKits.service';

type KitBody = {
  slug?: string;
  title?: string;
  imageUrl?: string | null;
  manufacturer?: string | null;
  status?: 'draft' | 'published';
  effectiveFrom?: string | null;
  reviewStatus?: string | null;
  sourceNotes?: string | null;
  manufacturerDocUrl?: string | null;
  metrics?: waterTestKitsService.KitMetricInput[];
};

export async function listKits(_req: Request, res: Response) {
  try {
    success(res, await waterTestKitsService.listAllKits());
  } catch (err) {
    console.error('listKits', err);
    error(res, 'INTERNAL_ERROR', 'Failed to list water test kits', 500);
  }
}

export async function getKit(req: Request, res: Response) {
  try {
    const kit = await waterTestKitsService.getKitById(req.params.id);
    if (!kit) return error(res, 'NOT_FOUND', 'Kit not found', 404);
    success(res, kit);
  } catch (err) {
    console.error('getKit', err);
    error(res, 'INTERNAL_ERROR', 'Failed to load kit', 500);
  }
}

export async function createKit(req: Request, res: Response) {
  try {
    const body = req.body as KitBody;
    if (!body?.slug || !body?.title || !Array.isArray(body.metrics)) {
      return error(res, 'VALIDATION_ERROR', 'slug, title, and metrics[] are required', 400);
    }
    const kit = await waterTestKitsService.createKit({
      slug: body.slug,
      title: body.title,
      imageUrl: body.imageUrl,
      manufacturer: body.manufacturer,
      status: body.status,
      effectiveFrom: body.effectiveFrom,
      reviewStatus: body.reviewStatus,
      sourceNotes: body.sourceNotes,
      manufacturerDocUrl: body.manufacturerDocUrl,
      metrics: body.metrics,
    });
    res.status(201);
    success(res, kit, 'Kit created');
  } catch (err) {
    console.error('createKit', err);
    error(res, 'INTERNAL_ERROR', 'Failed to create kit', 500);
  }
}

export async function updateKit(req: Request, res: Response) {
  try {
    const kit = await waterTestKitsService.updateKit(req.params.id, req.body ?? {});
    if (!kit) return error(res, 'NOT_FOUND', 'Kit not found', 404);
    success(res, kit, 'Kit updated');
  } catch (err) {
    console.error('updateKit', err);
    error(res, 'INTERNAL_ERROR', 'Failed to update kit', 500);
  }
}

export async function deleteKit(req: Request, res: Response) {
  try {
    const ok = await waterTestKitsService.deleteKit(req.params.id);
    if (!ok) return error(res, 'NOT_FOUND', 'Kit not found', 404);
    success(res, { id: req.params.id }, 'Kit deleted');
  } catch (err) {
    console.error('deleteKit', err);
    error(res, 'INTERNAL_ERROR', 'Failed to delete kit', 500);
  }
}
