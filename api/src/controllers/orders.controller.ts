import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import {
  getOrderReferenceForUser,
  listOrderReferencesForUser,
} from '../services/orderReference.service';

function toPublicOrder(o: {
  id: string;
  shopifyOrderId: string;
  shopifyOrderNumber: number | null;
  createdAt: Date;
}) {
  return {
    id: o.id,
    shopifyOrderId: o.shopifyOrderId,
    shopifyOrderNumber: o.shopifyOrderNumber,
    createdAt: o.createdAt,
  };
}

/**
 * GET /orders — authenticated customer orders for this tenant (webhook-matched user_id only).
 */
export async function listMyOrders(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  if (req.userIsTenantAdminOverride) {
    success(res, {
      orders: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    return;
  }

  const userId = req.user?.id;
  if (!userId || typeof userId !== 'string' || userId.startsWith('admin_')) {
    error(res, 'UNAUTHORIZED', 'User context required', 401);
    return;
  }

  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

  const { rows, total } = await listOrderReferencesForUser(tenantId, userId, page, pageSize);
  const totalPages = Math.ceil(total / pageSize) || 0;

  success(res, {
    orders: rows.map(toPublicOrder),
    pagination: { page, pageSize, total, totalPages },
  });
}

/**
 * GET /orders/by-shopify/:shopifyOrderId — single order if it belongs to the caller.
 */
export async function getMyOrderByShopifyId(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  if (req.userIsTenantAdminOverride) {
    error(res, 'NOT_FOUND', 'Order not found', 404);
    return;
  }

  const userId = req.user?.id;
  if (!userId || typeof userId !== 'string' || userId.startsWith('admin_')) {
    error(res, 'UNAUTHORIZED', 'User context required', 401);
    return;
  }

  const shopifyOrderId = String(req.params.shopifyOrderId || '').trim();
  if (!shopifyOrderId || shopifyOrderId.length > 64) {
    error(res, 'VALIDATION_ERROR', 'Invalid order id', 400);
    return;
  }

  const row = await getOrderReferenceForUser(tenantId, userId, shopifyOrderId);
  if (!row) {
    error(res, 'NOT_FOUND', 'Order not found', 404);
    return;
  }

  success(res, toPublicOrder(row));
}
