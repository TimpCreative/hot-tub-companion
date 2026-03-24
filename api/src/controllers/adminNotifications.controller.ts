import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import * as notificationService from '../services/notification.service';

function buildNotificationPayload(
  linkType: string | null,
  linkId: string | null,
  imageUrl: string | null
): notificationService.SendNotificationOptions {
  const opts: notificationService.SendNotificationOptions = {};
  if (linkType && linkId) {
    opts.data = { linkType, linkId };
  }
  if (imageUrl) {
    opts.imageUrl = imageUrl;
  }
  return opts;
}

interface AdminRole {
  can_send_notifications?: boolean;
}

function requireNotificationPermission(req: Request, res: Response): boolean {
  const role = (req as any).adminRole as AdminRole | undefined;
  if (!role?.can_send_notifications) {
    error(res, 'FORBIDDEN', 'Missing permission: can_send_notifications', 403);
    return false;
  }
  return true;
}

export async function listNotifications(req: Request, res: Response): Promise<void> {
  if (!requireNotificationPermission(req, res)) return;

  const tenantId = (req as any).tenant?.id as string;
  const status = (req.query.status as string) || 'scheduled';

  const validStatuses = ['scheduled', 'sent', 'cancelled'];
  if (!validStatuses.includes(status)) {
    error(res, 'VALIDATION_ERROR', 'Invalid status filter', 400);
    return;
  }

  const rows = await db('scheduled_notifications')
    .where({ tenant_id: tenantId, status })
    .orderBy('send_at', 'desc')
    .limit(100);

  success(res, { notifications: rows });
}

export async function createNotification(req: Request, res: Response): Promise<void> {
  if (!requireNotificationPermission(req, res)) return;

  const tenantId = (req as any).tenant?.id as string;
  const user = (req as any).user as { id?: string } | undefined;
  const isOverride = !!(req as any).userIsTenantAdminOverride;

  const body = req.body as {
    title?: string;
    body?: string;
    linkType?: string;
    linkId?: string;
    imageUrl?: string | null;
    sendAt?: string;
    target?: string;
  };

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 255) : '';
  const bodyText = typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : '';
  if (!title || !bodyText) {
    error(res, 'VALIDATION_ERROR', 'Title and body are required', 400);
    return;
  }

  const target = body.target === 'segment' ? 'segment' : 'all_customers';
  const linkType = typeof body.linkType === 'string' ? body.linkType.slice(0, 30) : null;
  const linkId = typeof body.linkId === 'string' ? body.linkId.slice(0, 255) : null;
  const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null;

  let sendAt: Date;
  if (body.sendAt && typeof body.sendAt === 'string') {
    sendAt = new Date(body.sendAt);
    if (Number.isNaN(sendAt.getTime())) {
      error(res, 'VALIDATION_ERROR', 'Invalid sendAt date', 400);
      return;
    }
  } else {
    sendAt = new Date();
  }

  const createdBy = isOverride || !user?.id || String(user.id).startsWith('admin_')
    ? null
    : user.id;
  const createdByEmail = isOverride && user ? (user as { email?: string }).email : null;

  const [inserted] = await db('scheduled_notifications')
    .insert({
      tenant_id: tenantId,
      created_by: createdBy,
      created_by_email: createdByEmail,
      title,
      body: bodyText,
      link_type: linkType,
      link_id: linkId,
      image_url: imageUrl,
      target,
      send_at: sendAt,
      status: 'scheduled',
    })
    .returning('*');

  if (sendAt <= new Date()) {
    const notifOpts = buildNotificationPayload(linkType, linkId, imageUrl);
    const { sent, failed } = await notificationService.sendToTenantCustomers(
      tenantId,
      title,
      bodyText,
      notifOpts,
      'promotional',
      {
        type: 'promotional',
        createdByType: 'retailer_admin',
        createdById: createdBy ?? createdByEmail ?? 'unknown',
      }
    );
    await db('scheduled_notifications')
      .where({ id: inserted.id })
      .update({
        status: 'sent',
        sent_at: db.fn.now(),
        recipients_count: sent + failed,
        delivered_count: sent,
      });
  }

  const updated = await db('scheduled_notifications').where({ id: inserted.id }).first();
  success(res, updated, 'Notification created');
}

export async function updateNotification(req: Request, res: Response): Promise<void> {
  if (!requireNotificationPermission(req, res)) return;

  const tenantId = (req as any).tenant?.id as string;
  const id = req.params.id;

  const existing = await db('scheduled_notifications')
    .where({ id, tenant_id: tenantId })
    .first();
  if (!existing) {
    error(res, 'NOT_FOUND', 'Notification not found', 404);
    return;
  }
  if (existing.status !== 'scheduled') {
    error(res, 'VALIDATION_ERROR', 'Only scheduled notifications can be updated', 400);
    return;
  }

  const body = req.body as { title?: string; body?: string; sendAt?: string };
  const update: Record<string, unknown> = {};
  if (typeof body.title === 'string' && body.title.trim()) {
    update.title = body.title.trim().slice(0, 255);
  }
  if (typeof body.body === 'string') {
    update.body = body.body.trim().slice(0, 2000);
  }
  if (body.sendAt && typeof body.sendAt === 'string') {
    const d = new Date(body.sendAt);
    if (!Number.isNaN(d.getTime())) update.send_at = d;
  }

  if (Object.keys(update).length === 0) {
    success(res, existing, 'No changes');
    return;
  }

  const [updated] = await db('scheduled_notifications')
    .where({ id, tenant_id: tenantId })
    .update(update)
    .returning('*');
  success(res, updated, 'Notification updated');
}

export async function cancelNotification(req: Request, res: Response): Promise<void> {
  if (!requireNotificationPermission(req, res)) return;

  const tenantId = (req as any).tenant?.id as string;
  const id = req.params.id;

  const existing = await db('scheduled_notifications')
    .where({ id, tenant_id: tenantId })
    .first();
  if (!existing) {
    error(res, 'NOT_FOUND', 'Notification not found', 404);
    return;
  }
  if (existing.status !== 'scheduled') {
    error(res, 'VALIDATION_ERROR', 'Only scheduled notifications can be cancelled', 400);
    return;
  }

  await db('scheduled_notifications')
    .where({ id, tenant_id: tenantId })
    .update({ status: 'cancelled' });
  success(res, { cancelled: true }, 'Notification cancelled');
}

export async function getNotificationStats(req: Request, res: Response): Promise<void> {
  if (!requireNotificationPermission(req, res)) return;

  const tenantId = (req as any).tenant?.id as string;
  const id = req.params.id;

  const row = await db('scheduled_notifications')
    .where({ id, tenant_id: tenantId })
    .select('id', 'title', 'status', 'recipients_count', 'delivered_count', 'sent_at')
    .first();
  if (!row) {
    error(res, 'NOT_FOUND', 'Notification not found', 404);
    return;
  }
  success(res, row);
}
