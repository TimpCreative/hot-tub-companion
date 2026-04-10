/**
 * Generates and refreshes auto maintenance_events from spa usage_months and winter_strategy.
 * Date math uses UTC calendar dates (v1).
 */

import { db } from '../config/database';
import { getEffectiveRecurringCatalog, normalizeCareScheduleConfig } from './careScheduleConfig.service';
import { planFilterMaintenanceEvents, type LastCompletedMap } from './filterMaintenancePlanner';
import { dedupePendingAutoEventsByEventType } from './maintenanceDedupe.service';
import { addUtcDays, diffUtcDays, formatDateKey, utcDateOnly } from './maintenanceDateUtils';
import {
  FILTER_CHAIN_EVENT_TYPES,
  MAINTENANCE_EVENT_COPY,
  type MaintenanceCatalogRecurring,
} from './maintenanceCatalog';

export type WinterStrategy = 'shutdown' | 'operate';

export type SpaProfileScheduleRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  usage_months: number[] | string | null;
  winter_strategy: WinterStrategy | string | null;
  created_at: Date | string;
};

export { computeNextRecurringDueDate, snapToNextUsageMonthStart } from './maintenanceDateUtils';

function utcStartOfMonthFromDate(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function addMonthsUtc(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));
}

export function parseUsageMonths(raw: number[] | string | null | undefined): number[] {
  let arr: number[] = [];
  if (raw == null) {
    arr = [];
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      arr = Array.isArray(parsed) ? (parsed as number[]) : [];
    } catch {
      arr = [];
    }
  } else {
    arr = raw;
  }
  const set = new Set(arr.filter((m) => typeof m === 'number' && m >= 1 && m <= 12));
  if (set.size === 0) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  return [...set].sort((a, b) => a - b);
}

function parseWinterStrategy(raw: string | null | undefined): WinterStrategy {
  if (raw === 'shutdown') return 'shutdown';
  return 'operate';
}

function buildHorizon(now: Date = new Date()): { horizonStart: Date; horizonEnd: Date } {
  const horizonStart = utcStartOfMonthFromDate(now);
  const endExclusive = new Date(Date.UTC(horizonStart.getUTCFullYear(), horizonStart.getUTCMonth() + 12, 1));
  const horizonEnd = addUtcDays(endExclusive, -1);
  return { horizonStart, horizonEnd };
}

function collectTransitionEvents(
  horizonStart: Date,
  horizonEnd: Date,
  usageMonths: number[],
  winterStrategy: WinterStrategy
): Array<{ eventType: string; dueDate: Date }> {
  if (winterStrategy !== 'shutdown') return [];

  const usage = new Set(usageMonths);
  const out: Array<{ eventType: string; dueDate: Date }> = [];
  const seen = new Set<string>();

  const firstBoundary = utcStartOfMonthFromDate(addMonthsUtc(horizonStart, -1));
  for (let i = 0; i <= 14; i++) {
    const monthStart = addMonthsUtc(firstBoundary, i);
    const prevStart = addMonthsUtc(monthStart, -1);
    const prevMonth = prevStart.getUTCMonth() + 1;
    const currMonth = monthStart.getUTCMonth() + 1;
    const prevOn = usage.has(prevMonth);
    const currOn = usage.has(currMonth);

    if (prevOn && !currOn) {
      const due = addUtcDays(monthStart, -14);
      const key = `winterize-${formatDateKey(due)}`;
      if (!seen.has(key) && due >= horizonStart && due <= horizonEnd) {
        seen.add(key);
        out.push({ eventType: 'winterize', dueDate: due });
      }
    }
    if (!prevOn && currOn) {
      const due = addUtcDays(monthStart, -7);
      const key = `spring_startup-${formatDateKey(due)}`;
      if (!seen.has(key) && due >= horizonStart && due <= horizonEnd) {
        seen.add(key);
        out.push({ eventType: 'spring_startup', dueDate: due });
      }
    }
  }

  return out;
}

const FILTER_TYPE_SET = new Set<string>(FILTER_CHAIN_EVENT_TYPES);

function collectSimpleRecurringEventRows(
  horizonStart: Date,
  horizonEnd: Date,
  usageMonths: number[],
  anchor: Date,
  spa: SpaProfileScheduleRow,
  recurringCatalog: MaintenanceCatalogRecurring[]
): Array<Record<string, unknown>> {
  const usage = new Set(usageMonths);
  const rows: Array<Record<string, unknown>> = [];
  const simpleCatalog = recurringCatalog.filter((s) => !FILTER_TYPE_SET.has(s.eventType));

  for (let d = new Date(horizonStart.getTime()); d <= horizonEnd; d = addUtcDays(d, 1)) {
    const month = d.getUTCMonth() + 1;
    if (!usage.has(month)) continue;

    const dayIndex = diffUtcDays(anchor, d);
    if (dayIndex < 0) continue;

    for (const spec of simpleCatalog) {
      if (dayIndex % spec.intervalDays !== 0) continue;

      const copy = MAINTENANCE_EVENT_COPY[spec.eventType];
      if (!copy) continue;

      rows.push({
        spa_profile_id: spa.id,
        user_id: spa.user_id,
        tenant_id: spa.tenant_id,
        event_type: spec.eventType,
        title: copy.title,
        description: copy.description,
        due_date: formatDateKey(d),
        completed_at: null,
        is_recurring: true,
        recurrence_interval_days: spec.intervalDays,
        notification_sent: false,
        notification_days_before: spec.notificationDaysBefore,
        linked_product_category: spec.linkedProductCategory,
        source: 'auto',
      });
    }
  }

  for (const t of collectTransitionEvents(horizonStart, horizonEnd, usageMonths, parseWinterStrategy(spa.winter_strategy))) {
    const copy = MAINTENANCE_EVENT_COPY[t.eventType];
    if (!copy) continue;
    rows.push({
      spa_profile_id: spa.id,
      user_id: spa.user_id,
      tenant_id: spa.tenant_id,
      event_type: t.eventType,
      title: copy.title,
      description: copy.description,
      due_date: formatDateKey(t.dueDate),
      completed_at: null,
      is_recurring: false,
      recurrence_interval_days: null,
      notification_sent: false,
      notification_days_before: 7,
      linked_product_category: 'chemical',
      source: 'auto',
    });
  }

  return rows;
}

function filterRowsFromPlanner(
  spa: SpaProfileScheduleRow,
  planned: ReturnType<typeof planFilterMaintenanceEvents>
): Array<Record<string, unknown>> {
  return planned.map((p) => {
    const copy = MAINTENANCE_EVENT_COPY[p.eventType];
    return {
      spa_profile_id: spa.id,
      user_id: spa.user_id,
      tenant_id: spa.tenant_id,
      event_type: p.eventType,
      title: copy?.title ?? p.eventType,
      description: copy?.description ?? '',
      due_date: formatDateKey(p.due),
      completed_at: null,
      is_recurring: true,
      recurrence_interval_days: p.intervalDays,
      notification_sent: false,
      notification_days_before: p.notificationDaysBefore,
      linked_product_category: p.linkedProductCategory,
      source: 'auto',
    };
  });
}

async function loadFilterLastCompletions(spaProfileId: string): Promise<LastCompletedMap> {
  const rows = (await db('maintenance_events')
    .where({ spa_profile_id: spaProfileId })
    .whereIn('event_type', [...FILTER_CHAIN_EVENT_TYPES])
    .whereNotNull('completed_at')
    .groupBy('event_type')
    .select('event_type', db.raw('max(completed_at) as last_completed'))) as {
    event_type: string;
    last_completed: Date | string;
  }[];

  const map: LastCompletedMap = {};
  for (const r of rows) {
    if (r.event_type === 'filter_rinse' || r.event_type === 'filter_deep_clean' || r.event_type === 'filter_replace') {
      map[r.event_type] = new Date(r.last_completed);
    }
  }
  return map;
}

async function hasOverdueIncompleteReplace(spaProfileId: string, todayKey: string): Promise<boolean> {
  const row = await db('maintenance_events')
    .where({ spa_profile_id: spaProfileId, event_type: 'filter_replace' })
    .whereNull('completed_at')
    .whereNull('deleted_at')
    .where('due_date', '<', todayKey)
    .first();
  return row != null;
}

export async function regenerateAutoEventsForSpaProfile(spaProfileId: string): Promise<void> {
  const spa = (await db('spa_profiles').where({ id: spaProfileId }).first()) as SpaProfileScheduleRow | undefined;
  if (!spa) return;

  const tenantRow = await db('tenants').where({ id: spa.tenant_id }).first();
  const careSchedule = normalizeCareScheduleConfig(
    (tenantRow as { care_schedule_config?: unknown } | undefined)?.care_schedule_config
  );
  const recurringCatalog = getEffectiveRecurringCatalog(careSchedule);

  const usageMonths = parseUsageMonths(spa.usage_months as number[] | string | null);
  const { horizonStart, horizonEnd } = buildHorizon();
  const todayKey = formatDateKey(utcDateOnly(new Date()));
  const anchor = utcDateOnly(spa.created_at);

  const lastCompleted = await loadFilterLastCompletions(spaProfileId);
  const overdueReplace = await hasOverdueIncompleteReplace(spaProfileId, todayKey);
  const applyPreReplaceRinseSuppression = !overdueReplace;

  const rinseSpec = recurringCatalog.find((e) => e.eventType === 'filter_rinse');
  const deepSpec = recurringCatalog.find((e) => e.eventType === 'filter_deep_clean');
  const replaceSpec = recurringCatalog.find((e) => e.eventType === 'filter_replace');

  const plannedFilter =
    rinseSpec || deepSpec || replaceSpec
      ? planFilterMaintenanceEvents({
          horizonStart,
          horizonEnd,
          usageMonths,
          spaCreatedAt: anchor,
          lastCompleted,
          rinse: rinseSpec
            ? {
                intervalDays: rinseSpec.intervalDays,
                notificationDaysBefore: rinseSpec.notificationDaysBefore,
                linkedProductCategory: rinseSpec.linkedProductCategory,
              }
            : undefined,
          deep: deepSpec
            ? {
                intervalDays: deepSpec.intervalDays,
                notificationDaysBefore: deepSpec.notificationDaysBefore,
                linkedProductCategory: deepSpec.linkedProductCategory,
              }
            : undefined,
          replace: replaceSpec
            ? {
                intervalDays: replaceSpec.intervalDays,
                notificationDaysBefore: replaceSpec.notificationDaysBefore,
                linkedProductCategory: replaceSpec.linkedProductCategory,
              }
            : undefined,
          applyPreReplaceRinseSuppression,
        })
      : [];

  await db.transaction(async (trx) => {
    await trx('maintenance_events')
      .where({ spa_profile_id: spaProfileId, source: 'auto' })
      .whereNull('completed_at')
      .whereNull('deleted_at')
      .where('due_date', '>=', todayKey)
      .del();

    const simpleRows = collectSimpleRecurringEventRows(horizonStart, horizonEnd, usageMonths, anchor, spa, recurringCatalog);
    const filterRows = filterRowsFromPlanner(spa, plannedFilter);

    const seen = new Set<string>();
    const merged: Array<Record<string, unknown>> = [];
    for (const r of [...filterRows, ...simpleRows]) {
      const key = `${r.event_type as string}|${r.due_date as string}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }

    const stamped = merged.map((r) => ({
      ...r,
      created_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    }));

    if (stamped.length > 0) {
      await trx('maintenance_events').insert(stamped);
    }

    await dedupePendingAutoEventsByEventType(spaProfileId, trx);
  });
}
