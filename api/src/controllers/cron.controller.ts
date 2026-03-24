import { Request, Response } from 'express';
import { db } from '../config/database';
import { success } from '../utils/response';
import * as notificationService from '../services/notification.service';

export async function dispatchNotifications(req: Request, res: Response): Promise<void> {
  const now = new Date();
  const rows = await db('scheduled_notifications')
    .where('send_at', '<=', now)
    .where('status', 'scheduled')
    .orderBy('send_at', 'asc')
    .limit(50);

  let processed = 0;
  for (const row of rows) {
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

  success(res, { processed }, 'Dispatch complete');
}
