import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import type { CreatePartInput } from '../types/uhtd.types';
import {
  UHTD_IMPORT_REJECT_REASONS,
  SHOPIFY_MAP_BULK_REJECT_MAX,
  listShopifyMapInbox,
  getShopifyMapRowDetail,
  rejectShopifyMapRow,
  bulkRejectShopifyMapRows,
  publishLinkExistingPart,
  publishCreatePart,
  sendShopifyMapForReview,
  listShopifyImportReviewQueue,
  dismissShopifyImportReview,
  approveShopifyImportReview,
} from '../services/superAdminShopifyMap.service';

function superAdminEmail(req: Request): string {
  return (req as Request & { superAdminEmail?: string }).superAdminEmail || 'unknown';
}

export async function inboxList(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '25'), 10) || 25));
  const tenantId = (req.query.tenantId as string) || undefined;
  const search = (req.query.search as string) || undefined;
  const mappingStatus = (req.query.mappingStatus as string) || undefined;
  const needsReverifyOnly = String(req.query.needsReverify || '') === 'true';
  const includeConfirmed = String(req.query.includeConfirmed || '') === 'true';

  const result = await listShopifyMapInbox({
    tenantId,
    page,
    pageSize,
    search,
    mappingStatus,
    needsReverifyOnly,
    includeConfirmed,
  });

  success(res, {
    rows: result.rows,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize) || 0,
    },
  });
}

export async function inboxDetail(req: Request, res: Response): Promise<void> {
  const { posProductId } = req.params;
  const detail = await getShopifyMapRowDetail(posProductId);
  if (!detail) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }
  success(res, detail);
}

export async function inboxReject(req: Request, res: Response): Promise<void> {
  const { posProductId } = req.params;
  const body = req.body as { reasonCode?: string; note?: string };
  const reasonCode = body.reasonCode as (typeof UHTD_IMPORT_REJECT_REASONS)[number];
  if (!reasonCode || !UHTD_IMPORT_REJECT_REASONS.includes(reasonCode)) {
    error(res, 'VALIDATION_ERROR', `reasonCode must be one of: ${UHTD_IMPORT_REJECT_REASONS.join(', ')}`, 400);
    return;
  }

  const row = await rejectShopifyMapRow(posProductId, reasonCode, body.note, superAdminEmail(req));
  if (!row) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }
  success(res, row);
}

export async function bulkReject(req: Request, res: Response): Promise<void> {
  const body = req.body as { posProductIds?: string[]; reasonCode?: string; note?: string };
  const ids = Array.isArray(body.posProductIds) ? body.posProductIds : [];
  const reasonCode = body.reasonCode as (typeof UHTD_IMPORT_REJECT_REASONS)[number];
  if (!reasonCode || !UHTD_IMPORT_REJECT_REASONS.includes(reasonCode)) {
    error(res, 'VALIDATION_ERROR', `reasonCode must be one of: ${UHTD_IMPORT_REJECT_REASONS.join(', ')}`, 400);
    return;
  }
  if (ids.length > SHOPIFY_MAP_BULK_REJECT_MAX) {
    error(res, 'VALIDATION_ERROR', `At most ${SHOPIFY_MAP_BULK_REJECT_MAX} ids per request`, 400);
    return;
  }

  const result = await bulkRejectShopifyMapRows(ids, reasonCode, body.note, superAdminEmail(req));
  success(res, result);
}

export async function inboxPublish(req: Request, res: Response): Promise<void> {
  const { posProductId } = req.params;
  const body = req.body as {
    mode?: string;
    uhtdPartId?: string;
    mappingConfidence?: number;
    part?: CreatePartInput;
  };

  if (body.mode === 'link') {
    if (!body.uhtdPartId) {
      error(res, 'VALIDATION_ERROR', 'uhtdPartId is required for link mode', 400);
      return;
    }
    const out = await publishLinkExistingPart(
      posProductId,
      body.uhtdPartId,
      body.mappingConfidence,
      superAdminEmail(req)
    );
    if (!out.ok) {
      error(res, out.code, out.message, out.code === 'NOT_FOUND' ? 404 : 400);
      return;
    }
    success(res, out.product);
    return;
  }

  if (body.mode === 'create') {
    if (!body.part || !body.part.categoryId || !body.part.name) {
      error(res, 'VALIDATION_ERROR', 'part.categoryId and part.name are required for create mode', 400);
      return;
    }
    try {
      const out = await publishCreatePart(
        posProductId,
        body.part,
        body.mappingConfidence,
        superAdminEmail(req)
      );
      if (!out.ok) {
        error(res, out.code, out.message, out.code === 'NOT_FOUND' ? 404 : 400);
        return;
      }
      success(res, { product: out.product, partId: out.partId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error(res, 'VALIDATION_ERROR', msg, 400);
    }
    return;
  }

  error(res, 'VALIDATION_ERROR', 'mode must be link or create', 400);
}

export async function inboxSendReview(req: Request, res: Response): Promise<void> {
  const { posProductId } = req.params;
  const body = req.body as { draftPayload?: Record<string, unknown> };
  const draft = body.draftPayload && typeof body.draftPayload === 'object' ? body.draftPayload : {};

  const out = await sendShopifyMapForReview(posProductId, draft, superAdminEmail(req));
  if (!out.ok) {
    error(res, out.code, out.message, out.code === 'NOT_FOUND' ? 404 : 400);
    return;
  }
  success(res, out.reviewItem);
}

export async function reviewQueueList(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '25'), 10) || 25));
  const tenantId = (req.query.tenantId as string) || undefined;

  const result = await listShopifyImportReviewQueue({ page, pageSize, tenantId });
  success(res, {
    rows: result.rows,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize) || 0,
    },
  });
}

export async function reviewQueueDismiss(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const row = await dismissShopifyImportReview(id, superAdminEmail(req));
  if (!row) {
    error(res, 'NOT_FOUND', 'Review item not found or not open', 404);
    return;
  }
  success(res, row);
}

export async function reviewQueueApprove(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body as {
    mode?: string;
    uhtdPartId?: string;
    mappingConfidence?: number;
    part?: CreatePartInput;
  };

  if (body.mode === 'link') {
    if (!body.uhtdPartId) {
      error(res, 'VALIDATION_ERROR', 'uhtdPartId is required', 400);
      return;
    }
    try {
      const out = await approveShopifyImportReview(id, {
        mode: 'link',
        uhtdPartId: body.uhtdPartId,
        mappingConfidence: body.mappingConfidence,
      }, superAdminEmail(req));
      if (!out.ok) {
        error(res, out.code, out.message, out.code === 'NOT_FOUND' ? 404 : 400);
        return;
      }
      success(res, { product: out.product, partId: out.partId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error(res, 'VALIDATION_ERROR', msg, 400);
    }
    return;
  }

  if (body.mode === 'create') {
    if (!body.part || !body.part.categoryId || !body.part.name) {
      error(res, 'VALIDATION_ERROR', 'part.categoryId and part.name are required', 400);
      return;
    }
    try {
      const out = await approveShopifyImportReview(
        id,
        { mode: 'create', part: body.part, mappingConfidence: body.mappingConfidence },
        superAdminEmail(req)
      );
      if (!out.ok) {
        error(res, out.code, out.message, out.code === 'NOT_FOUND' ? 404 : 400);
        return;
      }
      success(res, { product: out.product, partId: out.partId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error(res, 'VALIDATION_ERROR', msg, 400);
    }
    return;
  }

  error(res, 'VALIDATION_ERROR', 'mode must be link or create', 400);
}
