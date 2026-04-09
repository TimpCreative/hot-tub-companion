import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { db } from '../config/database';
import { getFirebaseAuth } from '../config/firebase';
import {
  claimOrderFromShopifyByEmailAndConfirmation,
  getOrderReferenceByIdForUser,
  getOrderReferenceForUser,
  listOrderReferencesForUser,
  syncOrderReferencesFromShopifyForUser,
  type OrderReferenceRow,
} from '../services/orderReference.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireVerifiedCustomerUser(
  req: Request,
  res: Response
): Promise<{ tenantId: string; userId: string; userRow: { email?: string; firebase_uid?: string } } | null> {
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return null;
  }
  if (req.userIsTenantAdminOverride) {
    error(res, 'FORBIDDEN', 'Not available for staff app login', 403);
    return null;
  }
  const userId = req.user?.id;
  if (!userId || typeof userId !== 'string' || userId.startsWith('admin_')) {
    error(res, 'UNAUTHORIZED', 'User context required', 401);
    return null;
  }
  const userRow = (await db('users')
    .select('email', 'firebase_uid')
    .where({ id: userId, tenant_id: tenantId })
    .whereNull('deleted_at')
    .first()) as { email?: string; firebase_uid?: string } | undefined;
  if (!userRow?.firebase_uid) {
    error(res, 'UNAUTHORIZED', 'User account not found', 401);
    return null;
  }
  const fbUser = await getFirebaseAuth().getUser(String(userRow.firebase_uid));
  if (!fbUser.emailVerified) {
    error(res, 'EMAIL_NOT_VERIFIED', 'Please verify your email before loading past orders.', 403);
    return null;
  }
  return { tenantId, userId, userRow };
}

function toPublicOrderListItem(o: OrderReferenceRow) {
  return {
    id: o.id,
    shopifyOrderId: o.shopifyOrderId,
    shopifyOrderNumber: o.shopifyOrderNumber,
    createdAt: o.createdAt,
    orderedAt: o.orderedAt,
    currency: o.currency,
    totalCents: o.totalCents,
    financialStatus: o.financialStatus,
    firstLineTitle: o.snapshot?.firstLineTitle ?? null,
    lineItemCount: o.snapshot?.lineItemCount ?? 0,
    hasSnapshot: o.snapshot != null,
  };
}

function toPublicOrderDetail(o: OrderReferenceRow) {
  return {
    ...toPublicOrderListItem(o),
    snapshot: o.snapshot,
    customerEmail: o.customerEmail,
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
    orders: rows.map(toPublicOrderListItem),
    pagination: { page, pageSize, total, totalPages },
  });
}

/**
 * GET /orders/:referenceId — single order with full snapshot (internal UUID).
 */
export async function getMyOrderByReferenceId(req: Request, res: Response): Promise<void> {
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

  const referenceId = String(req.params.referenceId || '').trim();
  if (!referenceId || !UUID_RE.test(referenceId)) {
    error(res, 'VALIDATION_ERROR', 'Invalid order id', 400);
    return;
  }

  const row = await getOrderReferenceByIdForUser(tenantId, userId, referenceId);
  if (!row) {
    error(res, 'NOT_FOUND', 'Order not found', 404);
    return;
  }

  success(res, toPublicOrderDetail(row));
}

/**
 * GET /orders/by-shopify/:shopifyOrderId — single order if it belongs to the caller (legacy + deep links).
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

  success(res, toPublicOrderDetail(row));
}

/**
 * POST /orders/sync — link past Shopify orders to this account (same email as profile) and refresh snapshots.
 */
export async function syncMyOrdersFromShopify(req: Request, res: Response): Promise<void> {
  const ctx = await requireVerifiedCustomerUser(req, res);
  if (!ctx) return;
  const email = typeof ctx.userRow.email === 'string' ? ctx.userRow.email.trim().toLowerCase() : '';
  if (!email) {
    error(res, 'VALIDATION_ERROR', 'Account email is required to sync orders', 400);
    return;
  }

  try {
    const result = await syncOrderReferencesFromShopifyForUser(ctx.tenantId, ctx.userId, email);
    success(res, result);
  } catch (e) {
    console.warn('[orders] syncMyOrdersFromShopify failed:', e);
    error(res, 'COMMERCE_ERROR', 'Could not sync orders from the store. Try again later.', 503);
  }
}

/**
 * POST /orders/claim — manual claim by order email + confirmation number.
 */
export async function claimMyOrderByEmailAndConfirmation(req: Request, res: Response): Promise<void> {
  const ctx = await requireVerifiedCustomerUser(req, res);
  if (!ctx) return;

  const body = (req.body || {}) as { orderEmail?: unknown; confirmationNumber?: unknown };
  const orderEmail = typeof body.orderEmail === 'string' ? body.orderEmail.trim().toLowerCase() : '';
  const confirmationNumber =
    typeof body.confirmationNumber === 'string' ? body.confirmationNumber.trim() : '';
  if (!orderEmail || !confirmationNumber) {
    error(res, 'VALIDATION_ERROR', 'orderEmail and confirmationNumber are required', 400);
    return;
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(orderEmail)) {
    error(res, 'VALIDATION_ERROR', 'Invalid order email format', 400);
    return;
  }

  try {
    const result = await claimOrderFromShopifyByEmailAndConfirmation(
      ctx.tenantId,
      ctx.userId,
      orderEmail,
      confirmationNumber
    );
    if (!result.ok) {
      error(res, 'NOT_FOUND', 'Order not found for that email and confirmation number', 404);
      return;
    }
    success(res, result);
  } catch (e) {
    console.warn('[orders] claimMyOrderByEmailAndConfirmation failed:', e);
    error(res, 'COMMERCE_ERROR', 'Could not load this order right now. Try again shortly.', 503);
  }
}
