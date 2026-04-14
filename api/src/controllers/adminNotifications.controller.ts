import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import * as notificationService from '../services/notification.service';
import * as notificationSecurityAudit from '../services/notificationSecurityAudit.service';
import { notificationTypeToCategory } from '../utils/notificationCategory';
import {
  decodeNotificationFeedCursor,
  encodeNotificationFeedCursor,
} from '../utils/notificationFeedCursor';

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
  tenant_id?: string;
}

function requireNotificationPermission(req: Request, res: Response): boolean {
  const role = (req as any).adminRole as AdminRole | undefined;
  if (!role?.can_send_notifications) {
    error(res, 'FORBIDDEN', 'Missing permission: can_send_notifications', 403);
    return false;
  }
  return true;
}

function requireTenantPolicyScope(req: Request, res: Response): boolean {
  const tenantId = (req as any).tenant?.id as string | undefined;
  const role = (req as any).adminRole as AdminRole | undefined;
  if (!tenantId || !role) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return false;
  }
  if (role.tenant_id && role.tenant_id !== tenantId) {
    error(res, 'FORBIDDEN', 'Tenant policy violation', 403);
    return false;
  }
  return true;
}

export async function listNotifications(req: Request, res: Response): Promise<void> {
  if (!requireNotificationPermission(req, res)) return;
  if (!requireTenantPolicyScope(req, res)) return;

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
  if (!requireTenantPolicyScope(req, res)) return;

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
    scheduleMode?: string;
    sendAtTime?: string;
    pastTimezoneHandling?: string;
  };

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 255) : '';
  const bodyText = typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : '';
  if (!title || !bodyText) {
    error(res, 'VALIDATION_ERROR', 'Title and body are required', 400);
    return;
  }

  const target = body.target === 'segment' ? 'segment' : 'all_customers';
  if (target !== 'all_customers') {
    await notificationSecurityAudit.logNotificationSecurityEvent({
      tenantId,
      actorUserId: (req as any).user?.id as string | undefined,
      actorEmail: (req as any).user?.email as string | undefined,
      actorRole: 'retailer_admin',
      eventType: 'notification_create',
      outcome: 'blocked',
      ...notificationSecurityAudit.requestAuditContext(req),
      details: { reason: 'target_segment_disabled' },
    });
    error(res, 'VALIDATION_ERROR', 'Segment notifications are disabled until tenant policy guards are finalized', 400);
    return;
  }
  const linkType = typeof body.linkType === 'string' ? body.linkType.slice(0, 30) : null;
  const linkId = typeof body.linkId === 'string' ? body.linkId.slice(0, 255) : null;
  const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  const scheduleMode =
    body.scheduleMode === 'user_local_time' ? 'user_local_time' : 'retailer_time';
  let sendAtTime: string | null = null;
  if (typeof body.sendAtTime === 'string' && body.sendAtTime.trim()) {
    const t = body.sendAtTime.trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) {
      const [h, m] = t.split(':').map(Number);
      sendAtTime = `${String(h ?? 0).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
    }
  }
  const pastTimezoneHandling =
    body.pastTimezoneHandling === 'push_next_day' ? 'push_next_day' : 'send_immediately';

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
      schedule_mode: scheduleMode,
      send_at_time: scheduleMode === 'user_local_time' ? sendAtTime || '09:00' : null,
      past_timezone_handling: scheduleMode === 'user_local_time' ? pastTimezoneHandling : null,
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
        scheduledNotificationId: inserted.id,
      },
      {
        actorUserId: createdBy ?? undefined,
        actorEmail: createdByEmail ?? (user as { email?: string } | undefined)?.email ?? undefined,
        actorRole: 'retailer_admin',
        ...notificationSecurityAudit.requestAuditContext(req),
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
  await notificationSecurityAudit.logNotificationSecurityEvent({
    tenantId,
    actorUserId: createdBy ?? undefined,
    actorEmail: createdByEmail ?? (user as { email?: string } | undefined)?.email ?? undefined,
    actorRole: 'retailer_admin',
    eventType: 'notification_create',
    outcome: 'success',
    ...notificationSecurityAudit.requestAuditContext(req),
    details: {
      notificationId: inserted.id,
      immediate: sendAt <= new Date(),
      target,
    },
  });
  success(res, updated, 'Notification created');
}

export async function updateNotification(req: Request, res: Response): Promise<void> {
  if (!requireNotificationPermission(req, res)) return;
  if (!requireTenantPolicyScope(req, res)) return;

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
  if (!requireTenantPolicyScope(req, res)) return;

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
  await notificationSecurityAudit.logNotificationSecurityEvent({
    tenantId,
    actorUserId: (req as any).user?.id as string | undefined,
    actorEmail: (req as any).user?.email as string | undefined,
    actorRole: 'retailer_admin',
    eventType: 'notification_cancel',
    outcome: 'success',
    ...notificationSecurityAudit.requestAuditContext(req),
    details: { notificationId: id },
  });
  success(res, { cancelled: true }, 'Notification cancelled');
}

export async function getNotificationStats(req: Request, res: Response): Promise<void> {
  if (!requireNotificationPermission(req, res)) return;
  if (!requireTenantPolicyScope(req, res)) return;

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

/** Static catalog for Retailer Admin → Notifications → Automated (Part 7). */
export function listAutomatedNotificationTemplates(req: Request, res: Response): void {
  if (!requireNotificationPermission(req, res)) return;
  if (!requireTenantPolicyScope(req, res)) return;

  success(res, {
    templates: [
      {
        id: 'care_schedule_maintenance',
        name: 'Care schedule maintenance',
        description:
          'Reminder when a care schedule task is due soon or overdue (one push per pending task while eligible).',
        firesWhen: 'Daily maintenance-reminders cron; user must have maintenance notifications enabled.',
      },
      {
        id: 'order_confirmed',
        name: 'Order confirmed',
        description: 'Confirmation when Shopify records a new order for the customer account email.',
        firesWhen: 'Shopify orders/create webhook after a matched user is found.',
      },
      {
        id: 'welcome',
        name: 'Welcome',
        description: 'Sent after the first spa profile is registered for the account.',
        firesWhen: 'Spa profile creation / UHTD onboarding completion flows.',
      },
      {
        id: 'retailer_promotional',
        name: 'Retailer promotional & scheduled',
        description: 'Manual or scheduled campaigns to customers who opted into promotional notifications.',
        firesWhen: 'Retailer composes a push or a scheduled notification is dispatched by cron.',
      },
      {
        id: 'global_announcement',
        name: 'Platform announcement',
        description: 'Broadcast from Super Admin to customers (all or your tenant), when used.',
        firesWhen: 'Super Admin sends an announcement targeting customers.',
      },
    ],
  });
}

export async function listNotificationHistory(req: Request, res: Response): Promise<void> {
  if (!requireNotificationPermission(req, res)) return;
  if (!requireTenantPolicyScope(req, res)) return;

  const tenantId = (req as any).tenant?.id as string;
  const limitRaw = parseInt(String(req.query.limit ?? '30'), 10);
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 30));
  const cursor = decodeNotificationFeedCursor(req.query.cursor as string | undefined);
  const typeFilter =
    typeof req.query.type === 'string' && req.query.type.trim() ? req.query.type.trim() : null;

  const base = db('notification_log')
    .leftJoin('users', 'users.id', 'notification_log.recipient_user_id')
    .where('notification_log.tenant_id', tenantId)
    .modify((qb) => {
      if (typeFilter) qb.where('notification_log.type', typeFilter);
    });

  const q = cursor
    ? base.whereRaw('(notification_log.sent_at, notification_log.id) < (?::timestamptz, ?::uuid)', [
        cursor.sentAt,
        cursor.id,
      ])
    : base;

  const rows = (await q
    .select(
      'notification_log.id',
      'notification_log.title',
      'notification_log.body',
      'notification_log.type',
      'notification_log.sent_at',
      'notification_log.created_by_type',
      'notification_log.created_by_id',
      'notification_log.scheduled_notification_id',
      'notification_log.payload',
      'notification_log.recipient_user_id',
      'users.email as recipient_email',
      'users.first_name as recipient_first_name',
      'users.last_name as recipient_last_name'
    )
    .orderBy('notification_log.sent_at', 'desc')
    .orderBy('notification_log.id', 'desc')
    .limit(limit + 1)) as Array<{
    id: string;
    title: string;
    body: string | null;
    type: string;
    sent_at: Date | string;
    created_by_type: string | null;
    created_by_id: string | null;
    scheduled_notification_id: string | null;
    payload: Record<string, unknown> | null;
    recipient_user_id: string | null;
    recipient_email: string | null;
    recipient_first_name: string | null;
    recipient_last_name: string | null;
  }>;

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeNotificationFeedCursor(last.sent_at as Date, last.id) : null;

  const items = page.map((r) => {
    const name = [r.recipient_first_name, r.recipient_last_name].filter(Boolean).join(' ').trim();
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      type: r.type,
      category: notificationTypeToCategory(r.type),
      sentAt: r.sent_at instanceof Date ? r.sent_at.toISOString() : String(r.sent_at),
      createdByType: r.created_by_type,
      createdById: r.created_by_id,
      scheduledNotificationId: r.scheduled_notification_id,
      payload: r.payload && typeof r.payload === 'object' ? r.payload : null,
      recipient: r.recipient_user_id
        ? {
            userId: r.recipient_user_id,
            email: r.recipient_email,
            displayName: name || r.recipient_email || 'Customer',
          }
        : null,
    };
  });

  success(res, { items, nextCursor });
}
