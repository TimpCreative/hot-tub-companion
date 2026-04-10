import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import { healAutoDuplicatesIfNeeded } from '../services/maintenanceDedupe.service';
import { addUtcDays, formatDateKey, utcDateOnly } from '../services/maintenanceDateUtils';
import { insertMaintenanceActivity, listMaintenanceActivity } from '../services/maintenanceActivity.service';
import * as maintenanceSchedule from '../services/maintenanceSchedule.service';
import { FILTER_CHAIN_EVENT_TYPES } from '../services/maintenanceCatalog';

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

function rowDueKey(row: Record<string, unknown>): string {
  const d = row.due_date;
  if (d instanceof Date) {
    return formatDateKey(d);
  }
  return String(d ?? '').slice(0, 10);
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
    snoozedUntil: row.snoozed_until ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function applyNotSnoozedPending(q: import('knex').Knex.QueryBuilder) {
  return q.where((b: import('knex').Knex.QueryBuilder) => {
    b.whereNull('snoozed_until').orWhereRaw('snoozed_until <= CURRENT_TIMESTAMP');
  });
}

function utcTodayKey(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, '0');
  const d = String(n.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** When a maintenance event is completed, sync spa_profiles tracking fields (same transaction). */
function spaTrackingPatchForCompletedEvent(eventType: string, completedAt: Date): Record<string, unknown> | null {
  const y = completedAt.getUTCFullYear();
  const mo = completedAt.getUTCMonth();
  const day = completedAt.getUTCDate();
  const dateOnly = new Date(Date.UTC(y, mo, day));

  switch (eventType) {
    case 'filter_rinse':
    case 'filter_deep_clean':
    case 'filter_replace':
      return { last_filter_change: dateOnly };
    case 'water_test':
      return { last_water_test_at: completedAt };
    case 'drain_refill':
      return { last_drain_refill_at: completedAt };
    case 'cover_check':
      return { last_cover_check_at: completedAt };
    default:
      return null;
  }
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
  await healAutoDuplicatesIfNeeded(spaProfileId);

  const today = utcTodayKey();
  let q = db('maintenance_events')
    .where({ spa_profile_id: spaProfileId, user_id: userId, tenant_id: tenantId })
    .whereNull('deleted_at');

  if (status === 'pending') {
    q = q.whereNull('completed_at');
    q = applyNotSnoozedPending(q);
  } else if (status === 'completed') {
    q = q.whereNotNull('completed_at');
  } else if (status === 'overdue') {
    q = q.whereNull('completed_at').where('due_date', '<', today);
    q = applyNotSnoozedPending(q);
  } else {
    q = q.where((outer) => {
      outer
        .whereNotNull('completed_at')
        .orWhere((inner) => {
          inner.whereNull('completed_at').where((s) => {
            s.whereNull('snoozed_until').orWhereRaw('snoozed_until <= CURRENT_TIMESTAMP');
          });
        });
    });
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
    .whereNull('deleted_at')
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
  const eventTypeStr = String(event.event_type ?? '');
  const isFilterChain = (FILTER_CHAIN_EVENT_TYPES as readonly string[]).includes(eventTypeStr);

  await db.transaction(async (trx) => {
    await trx('maintenance_events').where({ id }).update({
      completed_at: now,
      updated_at: trx.fn.now(),
    });

    await insertMaintenanceActivity(
      {
        spaProfileId: event.spa_profile_id as string,
        userId,
        tenantId,
        maintenanceEventId: id,
        action: 'completed',
        payload: {
          title: event.title,
          eventType: event.event_type,
          dueDate: rowDueKey(event),
          completedAt: now.toISOString(),
        },
      },
      trx
    );

    const isRecurring = event.is_recurring === true;
    const interval =
      typeof event.recurrence_interval_days === 'number' ? event.recurrence_interval_days : null;
    if (isRecurring && interval && interval > 0 && !isFilterChain) {
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

    const trackingPatch = spaTrackingPatchForCompletedEvent(String(event.event_type ?? ''), now);
    if (trackingPatch && Object.keys(trackingPatch).length > 0) {
      await trx('spa_profiles')
        .where({ id: event.spa_profile_id as string, user_id: userId, tenant_id: tenantId })
        .update({ ...trackingPatch, updated_at: trx.fn.now() });
    }
  });

  if (isFilterChain) {
    void maintenanceSchedule.regenerateAutoEventsForSpaProfile(event.spa_profile_id as string).catch((err) => {
      console.error('regenerateAutoEventsForSpaProfile after filter complete', err);
    });
  }

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

  const mapped = mapEvent(row as Record<string, unknown>);
  await insertMaintenanceActivity({
    spaProfileId: body.spaProfileId,
    userId,
    tenantId,
    maintenanceEventId: mapped.id as string,
    action: 'created',
    payload: { title: mapped.title, dueDate: body.dueDate },
  });

  res.status(201);
  success(res, { event: mapped }, 'Created');
}

export async function updateCustomMaintenance(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const id = req.params.id as string;
  const body = req.body as { title?: string; description?: string | null; dueDate?: string };

  const existing = (await db('maintenance_events')
    .where({ id, user_id: userId, tenant_id: tenantId })
    .whereNull('deleted_at')
    .first()) as Record<string, unknown> | undefined;

  if (!existing) {
    error(res, 'NOT_FOUND', 'Maintenance event not found', 404);
    return;
  }
  if (existing.source !== 'custom') {
    error(res, 'FORBIDDEN', 'Only custom events can be edited', 403);
    return;
  }

  const priorDue = rowDueKey(existing);
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
  const newDue = rowDueKey(row);
  if (body.dueDate !== undefined && newDue !== priorDue) {
    await insertMaintenanceActivity({
      spaProfileId: row.spa_profile_id as string,
      userId,
      tenantId,
      maintenanceEventId: id,
      action: 'rescheduled',
      payload: { title: row.title, fromDueDate: priorDue, toDueDate: newDue, via: 'edit' },
    });
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
    .whereNull('deleted_at')
    .first()) as Record<string, unknown> | undefined;

  if (!existing) {
    error(res, 'NOT_FOUND', 'Maintenance event not found', 404);
    return;
  }
  if (existing.source !== 'custom') {
    error(res, 'FORBIDDEN', 'Only custom events can be deleted', 403);
    return;
  }

  await insertMaintenanceActivity({
    spaProfileId: existing.spa_profile_id as string,
    userId,
    tenantId,
    maintenanceEventId: id,
    action: 'deleted',
    payload: {
      title: existing.title,
      eventType: existing.event_type,
      dueDate: rowDueKey(existing),
    },
  });

  await db('maintenance_events').where({ id }).update({
    deleted_at: db.fn.now(),
    updated_at: db.fn.now(),
  });
  success(res, { deleted: true });
}

const MAX_RESCHEDULE_DAYS_AHEAD = 366;

export async function listMaintenanceActivityFeed(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const spaProfileId = req.query.spaProfileId as string | undefined;
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

  const result = await listMaintenanceActivity({ spaProfileId, userId, tenantId, page, pageSize });
  success(res, result);
}

export async function snoozeMaintenance(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const id = req.params.id as string;
  const body = req.body as { preset?: string; customUntil?: string };

  const event = (await db('maintenance_events')
    .where({ id, user_id: userId, tenant_id: tenantId })
    .whereNull('deleted_at')
    .first()) as Record<string, unknown> | undefined;

  if (!event) {
    error(res, 'NOT_FOUND', 'Maintenance event not found', 404);
    return;
  }
  if (event.completed_at) {
    error(res, 'VALIDATION_ERROR', 'Cannot snooze a completed event', 400);
    return;
  }

  const today = utcTodayKey();
  const dk = rowDueKey(event);
  if (dk >= today) {
    error(res, 'VALIDATION_ERROR', 'Snooze is only for overdue tasks', 400);
    return;
  }

  const preset = typeof body.preset === 'string' ? body.preset : '';
  let snoozedUntil: Date;
  const nowMs = Date.now();

  if (preset === '1h') {
    snoozedUntil = new Date(nowMs + 60 * 60 * 1000);
  } else if (preset === '1d') {
    snoozedUntil = new Date(nowMs + 24 * 60 * 60 * 1000);
  } else if (preset === '7d') {
    snoozedUntil = new Date(nowMs + 7 * 24 * 60 * 60 * 1000);
  } else if (preset === 'custom') {
    if (!body.customUntil || typeof body.customUntil !== 'string') {
      error(res, 'VALIDATION_ERROR', 'customUntil ISO timestamp is required for custom snooze', 400);
      return;
    }
    snoozedUntil = new Date(body.customUntil);
    if (Number.isNaN(snoozedUntil.getTime()) || snoozedUntil.getTime() <= nowMs) {
      error(res, 'VALIDATION_ERROR', 'customUntil must be a future time', 400);
      return;
    }
  } else {
    error(res, 'VALIDATION_ERROR', 'preset must be 1h, 1d, 7d, or custom', 400);
    return;
  }

  await db('maintenance_events').where({ id }).update({
    snoozed_until: snoozedUntil,
    notification_sent: false,
    updated_at: db.fn.now(),
  });

  await insertMaintenanceActivity({
    spaProfileId: event.spa_profile_id as string,
    userId,
    tenantId,
    maintenanceEventId: id,
    action: 'snoozed',
    payload: {
      title: event.title,
      eventType: event.event_type,
      dueDate: dk,
      preset: preset || null,
      snoozedUntil: snoozedUntil.toISOString(),
    },
  });

  const updated = await db('maintenance_events').where({ id }).first();
  success(res, { event: mapEvent(updated as Record<string, unknown>) }, 'Snoozed');
}

export async function rescheduleMaintenance(req: Request, res: Response): Promise<void> {
  const userId = requireCustomerUser(req, res);
  if (!userId) return;

  const tenantId = (req as any).tenant?.id as string;
  const id = req.params.id as string;
  const body = req.body as { preset?: string; dueDate?: string };

  const event = (await db('maintenance_events')
    .where({ id, user_id: userId, tenant_id: tenantId })
    .whereNull('deleted_at')
    .first()) as Record<string, unknown> | undefined;

  if (!event) {
    error(res, 'NOT_FOUND', 'Maintenance event not found', 404);
    return;
  }
  if (event.completed_at) {
    error(res, 'VALIDATION_ERROR', 'Cannot reschedule a completed event', 400);
    return;
  }

  const today = utcTodayKey();
  const priorDue = rowDueKey(event);
  if (priorDue < today) {
    error(res, 'VALIDATION_ERROR', 'Reschedule applies to tasks that are not overdue', 400);
    return;
  }

  const preset = typeof body.preset === 'string' ? body.preset : '';
  let newKey: string;

  const baseDate = utcDateOnly(`${priorDue}T12:00:00.000Z`);

  if (preset === '1d') {
    newKey = formatDateKey(addUtcDays(baseDate, 1));
  } else if (preset === '7d') {
    newKey = formatDateKey(addUtcDays(baseDate, 7));
  } else if (preset === 'custom') {
    if (!body.dueDate || typeof body.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
      error(res, 'VALIDATION_ERROR', 'dueDate must be YYYY-MM-DD for custom reschedule', 400);
      return;
    }
    newKey = body.dueDate;
    if (newKey < today) {
      error(res, 'VALIDATION_ERROR', 'New due date cannot be before today (UTC)', 400);
      return;
    }
    const maxKey = formatDateKey(addUtcDays(utcDateOnly(`${today}T12:00:00.000Z`), MAX_RESCHEDULE_DAYS_AHEAD));
    if (newKey > maxKey) {
      error(res, 'VALIDATION_ERROR', `dueDate cannot be more than ${MAX_RESCHEDULE_DAYS_AHEAD} days out`, 400);
      return;
    }
  } else {
    error(res, 'VALIDATION_ERROR', 'preset must be 1d, 7d, or custom', 400);
    return;
  }

  if (newKey === priorDue) {
    error(res, 'VALIDATION_ERROR', 'Due date unchanged', 400);
    return;
  }

  await db('maintenance_events').where({ id }).update({
    due_date: newKey,
    snoozed_until: null,
    notification_sent: false,
    updated_at: db.fn.now(),
  });

  await insertMaintenanceActivity({
    spaProfileId: event.spa_profile_id as string,
    userId,
    tenantId,
    maintenanceEventId: id,
    action: 'rescheduled',
    payload: {
      title: event.title,
      eventType: event.event_type,
      fromDueDate: priorDue,
      toDueDate: newKey,
      preset,
    },
  });

  const updated = await db('maintenance_events').where({ id }).first();
  success(res, { event: mapEvent(updated as Record<string, unknown>) }, 'Rescheduled');
}
