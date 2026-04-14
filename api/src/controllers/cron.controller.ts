import { Request, Response } from 'express';
import { db } from '../config/database';
import { success } from '../utils/response';
import * as notificationService from '../services/notification.service';
import { localToUTC, addDays } from '../utils/timezone';
import { shopifyAdapter, fetchShopifyAdminOrderJson } from '../integrations/shopifyAdapter';
import { logPosIntegrationActivity } from '../services/posIntegrationActivity.service';
import {
  listOrderReferencesMissingSnapshot,
  mergeOrderSnapshotFromShopifyPayload,
} from '../services/orderReference.service';
import * as maintenanceSchedule from '../services/maintenanceSchedule.service';

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
        scheduledNotificationId: id,
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

/**
 * Incremental Shopify catalog pull for tenants with automatic sync enabled.
 * Run every 1–2 minutes externally (e.g. Railway cron); per-tenant `product_sync_interval_minutes` throttles work.
 */
export async function syncShopifyCatalog(req: Request, res: Response): Promise<void> {
  const now = new Date();

  type TenantCronRow = {
    id: string;
    product_sync_interval_minutes: number | null;
    last_cron_product_sync_at: Date | string | null;
    last_product_sync_at: Date | string | null;
  };

  const tenants = (await db('tenants')
    .select('id', 'product_sync_interval_minutes', 'last_cron_product_sync_at', 'last_product_sync_at')
    .where({ pos_type: 'shopify', shopify_catalog_sync_enabled: true })) as TenantCronRow[];

  let processed = 0;
  let skippedThrottle = 0;
  let errors = 0;

  for (const t of tenants) {
    const intervalMin =
      typeof t.product_sync_interval_minutes === 'number' &&
      Number.isFinite(t.product_sync_interval_minutes)
        ? Math.min(1440, Math.max(1, Math.floor(t.product_sync_interval_minutes)))
        : 30;

    const lastCron = t.last_cron_product_sync_at ? new Date(t.last_cron_product_sync_at) : null;
    if (lastCron && now.getTime() - lastCron.getTime() < intervalMin * 60 * 1000) {
      skippedThrottle++;
      continue;
    }

    try {
      const existingPosProduct = await db('pos_products').where({ tenant_id: t.id }).select('id').first();
      const hasAnyPosProducts = !!existingPosProduct;
      const since =
        hasAnyPosProducts && t.last_product_sync_at
          ? new Date(t.last_product_sync_at)
          : undefined;

      const syncSummary = await shopifyAdapter.syncCatalog(t.id, { full: false, since });

      await db('tenants').where({ id: t.id }).update({
        last_product_sync_at: now,
        last_cron_product_sync_at: now,
        updated_at: db.fn.now(),
      });
      await logPosIntegrationActivity(t.id, {
        eventType: 'cron_incremental_sync',
        summary: `Scheduled incremental sync: ${syncSummary.created} created, ${syncSummary.updated} updated, ${syncSummary.errors.length} error(s)`,
        source: 'cron',
        metadata: {
          created: syncSummary.created,
          updated: syncSummary.updated,
          deletedOrArchived: syncSummary.deletedOrArchived,
          errorCount: syncSummary.errors.length,
        },
      });
      processed++;
    } catch (err: unknown) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[cron] syncShopifyCatalog tenant ${t.id}:`, msg);
    }
  }

  success(
    res,
    { processed, skippedThrottle, errors, tenantsChecked: tenants.length },
    'Shopify catalog cron complete'
  );
}

function utcDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function addCalendarDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, mo, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, mo - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Daily UTC: (1) notify from (due − lead) through due (inclusive);
 * (2) one-time overdue nudge if still pending and notification_sent is still false (e.g. missed pre-due window).
 * Respects notification_pref_maintenance.
 */
export async function maintenanceReminders(req: Request, res: Response): Promise<void> {
  const todayKey = utcDateKey(new Date());

  type Row = {
    id: string;
    user_id: string;
    tenant_id: string;
    spa_profile_id: string;
    title: string;
    due_date: Date | string;
    notification_days_before: number | null;
    nickname: string | null;
    model: string | null;
  };

  const rows = (await db('maintenance_events as e')
    .join('spa_profiles as s', 'e.spa_profile_id', 's.id')
    .whereNull('e.completed_at')
    .whereNull('e.deleted_at')
    .where((b) => {
      b.whereNull('e.snoozed_until').orWhereRaw('e.snoozed_until <= CURRENT_TIMESTAMP');
    })
    .where('e.notification_sent', false)
    .select(
      'e.id',
      'e.user_id',
      'e.tenant_id',
      'e.spa_profile_id',
      'e.title',
      'e.due_date',
      'e.notification_days_before',
      's.nickname',
      's.model'
    )) as Row[];

  let notified = 0;
  let notifiedLeadUp = 0;
  let notifiedOverdue = 0;
  for (const row of rows) {
    const dueStr =
      typeof row.due_date === 'string'
        ? row.due_date.slice(0, 10)
        : utcDateKey(new Date(row.due_date));
    const lead = typeof row.notification_days_before === 'number' ? row.notification_days_before : 3;
    const notifyStr = addCalendarDaysToDateKey(dueStr, -lead);
    if (todayKey < notifyStr) continue;

    const spaLabel = row.nickname?.trim() || row.model?.trim() || 'your spa';
    const inLeadUpWindow = todayKey <= dueStr;
    const body = inLeadUpWindow
      ? `${row.title} is due soon for ${spaLabel}.`
      : `${row.title} is overdue for ${spaLabel}.`;

    const ok = await notificationService.sendToUser(
      row.user_id,
      row.tenant_id,
      'Maintenance reminder',
      body,
      {
        linkType: 'maintenance_event',
        linkId: row.id,
        spaProfileId: row.spa_profile_id,
      },
      'maintenance',
      { type: 'maintenance_reminder' }
    );
    if (ok) {
      await db('maintenance_events').where({ id: row.id }).update({
        notification_sent: true,
        updated_at: db.fn.now(),
      });
      notified++;
      if (inLeadUpWindow) notifiedLeadUp++;
      else notifiedOverdue++;
    }
  }

  success(
    res,
    { candidates: rows.length, notified, notifiedLeadUp, notifiedOverdue },
    'Maintenance reminders complete'
  );
}

/**
 * Rebuild auto-generated maintenance rows (12-month horizon + dedupe). Secured with CRON_SECRET.
 * Query: ?spaProfileId=<uuid> for one spa; omit to process all spa profiles.
 */
export async function regenerateMaintenanceSchedules(req: Request, res: Response): Promise<void> {
  const spaProfileIdRaw = req.query.spaProfileId;
  const spaProfileId =
    typeof spaProfileIdRaw === 'string' && spaProfileIdRaw.trim() ? spaProfileIdRaw.trim() : '';

  const ids: string[] = spaProfileId
    ? [spaProfileId]
    : ((await db('spa_profiles').select('id')) as { id: string }[]).map((r) => r.id);

  let processed = 0;
  const failures: Array<{ spaProfileId: string; message: string }> = [];

  for (const id of ids) {
    try {
      await maintenanceSchedule.regenerateAutoEventsForSpaProfile(id);
      processed++;
    } catch (err) {
      failures.push({
        spaProfileId: id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  success(res, { processed, total: ids.length, failures }, 'Maintenance schedule regeneration complete');
}

/**
 * Backfill order_references.snapshot from Shopify Admin for rows with user_id but null snapshot.
 * Query: ?limit=25 (max 100). Throttled for Admin API; run periodically until queue empty.
 */
export async function backfillOrderSnapshots(req: Request, res: Response): Promise<void> {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10) || 25));
  const rows = await listOrderReferencesMissingSnapshot(limit);
  let ok = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const orderJson = await fetchShopifyAdminOrderJson(row.tenantId, row.shopifyOrderId);
      if (!orderJson) {
        failed++;
        continue;
      }
      const merged = await mergeOrderSnapshotFromShopifyPayload(
        row.tenantId,
        row.shopifyOrderId,
        orderJson
      );
      if (merged) ok++;
      else failed++;
    } catch {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  success(
    res,
    { batchSize: rows.length, snapshotsWritten: ok, failed },
    'Order snapshot backfill batch complete'
  );
}
