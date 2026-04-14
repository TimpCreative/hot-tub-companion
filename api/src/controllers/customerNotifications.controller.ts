import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import { notificationTypeToCategory } from '../utils/notificationCategory';
import {
  decodeNotificationFeedCursor,
  encodeNotificationFeedCursor,
} from '../utils/notificationFeedCursor';

function requireCustomerUser(req: Request, res: Response): string | null {
  if ((req as any).userIsTenantAdminOverride) {
    error(res, 'FORBIDDEN', 'Notifications require a customer account', 403);
    return null;
  }
  const id = (req as any).user?.id as string | undefined;
  if (!id || id.startsWith('admin_')) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return null;
  }
  return id;
}

export async function listMyNotifications(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;
  const tenantId = (req as any).tenant?.id as string;

  const limitRaw = parseInt(String(req.query.limit ?? '20'), 10);
  const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));
  const cursor = decodeNotificationFeedCursor(req.query.cursor as string | undefined);

  const base = db('notification_log').where({ recipient_user_id: userId, tenant_id: tenantId });
  const q = cursor
    ? base.whereRaw('(sent_at, id) < (?::timestamptz, ?::uuid)', [cursor.sentAt, cursor.id])
    : base;

  const rows = (await q
    .orderBy('sent_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit + 1)) as Array<{
    id: string;
    title: string;
    body: string | null;
    type: string;
    sent_at: Date | string;
    read_at: Date | string | null;
    payload: Record<string, unknown> | null;
  }>;

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeNotificationFeedCursor(last.sent_at as Date, last.id) : null;

  const notifications = page.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    type: r.type,
    category: notificationTypeToCategory(r.type),
    sentAt: r.sent_at instanceof Date ? r.sent_at.toISOString() : String(r.sent_at),
    readAt:
      r.read_at == null
        ? null
        : r.read_at instanceof Date
          ? r.read_at.toISOString()
          : String(r.read_at),
    payload: r.payload && typeof r.payload === 'object' ? r.payload : null,
  }));

  success(res, { notifications, nextCursor });
}

export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;
  const tenantId = (req as any).tenant?.id as string;
  const id = req.params.id;
  if (!id || typeof id !== 'string') {
    error(res, 'VALIDATION_ERROR', 'Invalid id', 400);
    return;
  }

  const updated = await db('notification_log')
    .where({ id, recipient_user_id: userId, tenant_id: tenantId })
    .update({
      read_at: db.fn.now(),
    });

  if (!updated) {
    error(res, 'NOT_FOUND', 'Notification not found', 404);
    return;
  }

  success(res, { read: true });
}
