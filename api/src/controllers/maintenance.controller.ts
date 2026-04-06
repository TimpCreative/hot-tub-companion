import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import * as maintenanceSchedule from '../services/maintenanceSchedule.service';

function requireCustomerUser(req: Request, res: Response): string | null {
  if ((req as any).userIsTenantAdminOverride) {
    error(res, 'FORBIDDEN', 'Maintenance requires a customer account', 403);
    return null;
  }
  const id = (req as any).user?.id as string | undefined;
  if (!id || id.startsWith('admin_')) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return null;
  }
  return id;
}

function mapEvent(row: Record<string, unknown>) {
  return {
    id: row.id,
    spaProfileId: row.spa_profile_id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    eventType: row.event_type,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    isRecurring: row.is_recurring,
    recurrenceIntervalDays: row.recurrence_interval_days,
    notificationSent: row.notification_sent,
    notificationDaysBefore: row.notification_days_before,
    linkedProductCategory: row.linked_product_category,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function utcTodayKey(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, '0');
  const d = String(n.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function ensureSpaOwned(
  spaProfileId: string,
  userId: string,
  tenantId: string
): Promise<Record<string, unknown> | null> {
  return (await db('spa_profiles')
    .where({ id: spaProfileId, user_id: userId, tenant_id: tenantId })
    .first()) as Record<string, unknown> | null;
}

/** Lazy-generate schedule the first time a spa has no maintenance rows. */
async function ensureScheduleIfEmpty(spaProfileId: string): Promise<void> {
  const row = await db('maintenance_events').where({ spa_profile_id: spaProfileId }).first();
  if (!row) await maintenanceSchedule.regenerateAutoEventsForSpaProfile(spaProfileId);
}

export async function listMaintenance(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const spaProfileId = req.query.spaProfileId as string | undefined;
  const status = (req.query.status as string | undefined)?.toLowerCase();
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '50'), 10) || 50));

  if (!spaProfileId || typeof spaProfileId !== 'string') {
    error(res, 'VALIDATION_ERROR', 'spaProfileId is required', 400);
    return;
  }

  const spa = await ensureSpaOwned(spaProfileId, userId, tenantId);
  if (!spa) {
    error(res, 'NOT_FOUND', 'Spa profile not found', 404);
    return;
  }

  await ensureScheduleIfEmpty(spaProfileId);

  const today = utcTodayKey();
  let q = db('maintenance_events').where({ spa_profile_id: spaProfileId, user_id: userId, tenant_id: tenantId });

  if (status === 'pending') {
    q = q.whereNull('completed_at');
  } else if (status === 'completed') {
    q = q.whereNotNull('completed_at');
  } else if (status === 'overdue') {
    q = q.whereNull('completed_at').where('due_date', '<', today);
  }

  const countRow = await q.clone().count('* as c').first();
  const total = parseInt(String((countRow as { c?: string })?.c ?? '0'), 10);

  const rows = await q
    .clone()
    .orderBy('due_date', 'asc')
    .orderBy('created_at', 'asc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  success(res, {
    events: rows.map((r) => mapEvent(r as Record<string, unknown>)),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
  });
}

export async function completeMaintenance(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const id = req.params.id as string;

  const event = (await db('maintenance_events')
    .where({ id, user_id: userId, tenant_id: tenantId })
    .first()) as Record<string, unknown> | undefined;

  if (!event) {
    error(res, 'NOT_FOUND', 'Maintenance event not found', 404);
    return;
  }
  if (event.completed_at) {
    error(res, 'VALIDATION_ERROR', 'Event already completed', 400);
    return;
  }

  const spa = (await db('spa_profiles')
    .where({ id: event.spa_profile_id as string, user_id: userId, tenant_id: tenantId })
    .first()) as Record<string, unknown> | undefined;
  if (!spa) {
    error(res, 'NOT_FOUND', 'Spa profile not found', 404);
    return;
  }

  const usageMonths = maintenanceSchedule.parseUsageMonths(spa.usage_months as number[] | string | null);

  const now = new Date();
  await db.transaction(async (trx) => {
    await trx('maintenance_events').where({ id }).update({
      completed_at: now,
      updated_at: trx.fn.now(),
    });

    const isRecurring = event.is_recurring === true;
    const interval =
      typeof event.recurrence_interval_days === 'number' ? event.recurrence_interval_days : null;
    if (isRecurring && interval && interval > 0) {
      const nextDue = maintenanceSchedule.computeNextRecurringDueDate(now, interval, usageMonths);
      const nextKey = `${nextDue.getUTCFullYear()}-${String(nextDue.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDue.getUTCDate()).padStart(2, '0')}`;

      await trx('maintenance_events').insert({
        spa_profile_id: event.spa_profile_id,
        user_id: event.user_id,
        tenant_id: event.tenant_id,
        event_type: event.event_type,
        title: event.title,
        description: event.description,
        due_date: nextKey,
        completed_at: null,
        is_recurring: true,
        recurrence_interval_days: interval,
        notification_sent: false,
        notification_days_before:
          typeof event.notification_days_before === 'number' ? event.notification_days_before : 3,
        linked_product_category: event.linked_product_category,
        source: 'auto',
        created_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });
    }
  });

  const updated = await db('maintenance_events').where({ id }).first();
  success(res, { event: mapEvent(updated as Record<string, unknown>) }, 'Marked complete');
}

export async function createCustomMaintenance(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const body = req.body as {
    spaProfileId?: string;
    title?: string;
    description?: string | null;
    dueDate?: string;
  };

  if (!body.spaProfileId || typeof body.spaProfileId !== 'string') {
    error(res, 'VALIDATION_ERROR', 'spaProfileId is required', 400);
    return;
  }
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    error(res, 'VALIDATION_ERROR', 'title is required', 400);
    return;
  }
  if (!body.dueDate || typeof body.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
    error(res, 'VALIDATION_ERROR', 'dueDate must be YYYY-MM-DD', 400);
    return;
  }

  const spa = await ensureSpaOwned(body.spaProfileId, userId, tenantId);
  if (!spa) {
    error(res, 'NOT_FOUND', 'Spa profile not found', 404);
    return;
  }

  const [row] = await db('maintenance_events')
    .insert({
      spa_profile_id: body.spaProfileId,
      user_id: userId,
      tenant_id: tenantId,
      event_type: 'custom',
      title: body.title.trim().slice(0, 255),
      description: body.description?.trim() || null,
      due_date: body.dueDate,
      completed_at: null,
      is_recurring: false,
      recurrence_interval_days: null,
      notification_sent: false,
      notification_days_before: 3,
      linked_product_category: null,
      source: 'custom',
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  res.status(201);
  success(res, { event: mapEvent(row as Record<string, unknown>) }, 'Created');
}

export async function updateCustomMaintenance(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const id = req.params.id as string;
  const body = req.body as { title?: string; description?: string | null; dueDate?: string };

  const existing = (await db('maintenance_events')
    .where({ id, user_id: userId, tenant_id: tenantId })
    .first()) as Record<string, unknown> | undefined;

  if (!existing) {
    error(res, 'NOT_FOUND', 'Maintenance event not found', 404);
    return;
  }
  if (existing.source !== 'custom') {
    error(res, 'FORBIDDEN', 'Only custom events can be edited', 403);
    return;
  }

  const update: Record<string, unknown> = { updated_at: db.fn.now() };
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      error(res, 'VALIDATION_ERROR', 'title cannot be empty', 400);
      return;
    }
    update.title = body.title.trim().slice(0, 255);
  }
  if (body.description !== undefined) update.description = body.description?.trim() || null;
  if (body.dueDate !== undefined) {
    if (typeof body.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
      error(res, 'VALIDATION_ERROR', 'dueDate must be YYYY-MM-DD', 400);
      return;
    }
    update.due_date = body.dueDate;
  }

  const updatedRows = await db('maintenance_events').where({ id }).update(update).returning('*');
  const row = updatedRows[0] as Record<string, unknown> | undefined;
  if (!row) {
    error(res, 'NOT_FOUND', 'Maintenance event not found', 404);
    return;
  }
  success(res, { event: mapEvent(row) }, 'Updated');
}

export async function deleteCustomMaintenance(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const id = req.params.id as string;

  const existing = (await db('maintenance_events')
    .where({ id, user_id: userId, tenant_id: tenantId })
    .first()) as Record<string, unknown> | undefined;

  if (!existing) {
    error(res, 'NOT_FOUND', 'Maintenance event not found', 404);
    return;
  }
  if (existing.source !== 'custom') {
    error(res, 'FORBIDDEN', 'Only custom events can be deleted', 403);
    return;
  }

  await db('maintenance_events').where({ id }).del();
  success(res, { deleted: true });
}
