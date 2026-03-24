import { Request, Response } from 'express';
import { db } from '../config/database';
import { success } from '../utils/response';
import * as notificationService from '../services/notification.service';
import { localToUTC, addDays } from '../utils/timezone';

export async function dispatchNotifications(req: Request, res: Response): Promise<void> {
  const now = new Date();

  const retailerRows = await db('scheduled_notifications')
    .where('send_at', '<=', now)
    .where('status', 'scheduled')
    .where('schedule_mode', 'retailer_time')
    .orderBy('send_at', 'asc')
    .limit(50);

  let processed = 0;

  for (const row of retailerRows) {
    const { id, tenant_id, title, body, link_type, link_id, image_url } = row as {
      id: string;
      tenant_id: string;
      title: string;
      body: string;
      link_type: string | null;
      link_id: string | null;
      image_url: string | null;
      created_by: string | null;
      created_by_email: string | null;
    };

    const createdById = row.created_by ?? row.created_by_email ?? 'cron';

    const opts: notificationService.SendNotificationOptions = {};
    if (link_type && link_id) opts.data = { linkType: link_type, linkId: link_id };
    if (image_url) opts.imageUrl = image_url;

    const { sent, failed } = await notificationService.sendToTenantCustomers(
      tenant_id,
      title,
      body,
      opts,
      'promotional',
      {
        type: 'promotional',
        createdByType: 'retailer_admin',
        createdById: String(createdById),
      }
    );

    await db('scheduled_notifications')
      .where({ id })
      .update({
        status: 'sent',
        sent_at: db.fn.now(),
        recipients_count: sent + failed,
        delivered_count: sent,
      });
    processed++;
  }

  const userLocalRows = await db('scheduled_notifications')
    .where('status', 'scheduled')
    .where('schedule_mode', 'user_local_time')
    .whereNotNull('send_at_time')
    .limit(50);

  const tenantCache = new Map<string, { timezone: string }>();

  for (const row of userLocalRows) {
    const {
      id,
      tenant_id,
      title,
      body,
      link_type,
      link_id,
      image_url,
      send_at,
      send_at_time,
      past_timezone_handling,
    } = row as {
      id: string;
      tenant_id: string;
      title: string;
      body: string;
      link_type: string | null;
      link_id: string | null;
      image_url: string | null;
      send_at: string | Date;
      send_at_time: string | null;
      past_timezone_handling: string | null;
    };

    let tenant = tenantCache.get(tenant_id);
    if (!tenant) {
      const t = await db('tenants').where({ id: tenant_id }).select('timezone').first();
      tenant = { timezone: (t?.timezone as string) || 'America/Denver' };
      tenantCache.set(tenant_id, tenant);
    }
    const retailerTimezone = tenant.timezone;

    const createdById = row.created_by ?? row.created_by_email ?? 'cron';
    const opts: notificationService.SendNotificationOptions = {};
    if (link_type && link_id) opts.data = { linkType: link_type, linkId: link_id };
    if (image_url) opts.imageUrl = image_url;

    const sendAtDate = new Date(send_at);
    const dateStr = sendAtDate.toISOString().slice(0, 10);
    const timeStr = (send_at_time || '09:00').slice(0, 5);
    const pushNextDay = past_timezone_handling === 'push_next_day';

    const users = await notificationService.getTenantCustomerTokensWithTimezone(
      tenant_id,
      retailerTimezone,
      'promotional'
    );
    const alreadySent = await notificationService.getAlreadySentUserIds(id);

    const toSend: string[] = [];
    for (const u of users) {
      if (alreadySent.has(u.id)) continue;

      let targetDate = dateStr;
      let targetMoment = localToUTC(dateStr, timeStr, u.timezone);

      if (pushNextDay && targetMoment < now) {
        targetDate = addDays(dateStr, 1);
        targetMoment = localToUTC(targetDate, timeStr, u.timezone);
      }

      if (targetMoment <= now) {
        toSend.push(u.id);
      }
    }

    if (toSend.length > 0) {
      const { sent, failed } = await notificationService.sendToSpecificUsers(
        toSend,
        tenant_id,
        title,
        body,
        opts,
        {
          type: 'promotional',
          createdByType: 'retailer_admin',
          createdById: String(createdById),
          scheduledNotificationId: id,
        }
      );

      const [current] = await db('scheduled_notifications')
        .where({ id })
        .select('recipients_count', 'delivered_count');
      const prevRecipients = Number((current as any)?.recipients_count ?? 0);
      const prevDelivered = Number((current as any)?.delivered_count ?? 0);

      await db('scheduled_notifications')
        .where({ id })
        .update({
          recipients_count: prevRecipients + sent + failed,
          delivered_count: prevDelivered + sent,
        });
      processed++;
    }

    const newAlreadySent = await notificationService.getAlreadySentUserIds(id);
    const totalEligible = users.length;
    if (newAlreadySent.size >= totalEligible && totalEligible > 0) {
      await db('scheduled_notifications')
        .where({ id })
        .update({ status: 'sent', sent_at: db.fn.now() });
    }
  }

  success(res, { processed }, 'Dispatch complete');
}
