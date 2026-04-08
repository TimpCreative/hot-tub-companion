/**
 * Generates and refreshes auto maintenance_events from spa usage_months and winter_strategy.
 * Date math uses UTC calendar dates (v1).
 */

import { db } from '../config/database';
import { getEffectiveRecurringCatalog, normalizeCareScheduleConfig } from './careScheduleConfig.service';
import {
  MAINTENANCE_EVENT_COPY,
  MAINTENANCE_RECURRING_CATALOG,
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

function utcDateOnly(d: Date | string): Date {
  const x = typeof d === 'string' ? new Date(d) : d;
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

function formatDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diffUtcDays(anchor: Date, d: Date): number {
  const a = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  const b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((b - a) / 86400000);
}

function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

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

/** First calendar day on or after `from` that falls in an in-use month (UTC). */
export function snapToNextUsageMonthStart(from: Date, usageMonths: number[]): Date {
  const set = new Set(usageMonths);
  if (set.size === 0) return utcDateOnly(from);
  let cur = utcDateOnly(from);
  for (let i = 0; i < 400; i++) {
    if (set.has(cur.getUTCMonth() + 1)) return cur;
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth();
    cur = new Date(Date.UTC(y, m + 1, 1));
  }
  return utcDateOnly(from);
}

/** Next recurring due: completed date + interval, snapped into an in-use month. */
export function computeNextRecurringDueDate(
  completedAtUtc: Date,
  intervalDays: number,
  usageMonths: number[]
): Date {
  const base = addUtcDays(utcDateOnly(completedAtUtc), intervalDays);
  return snapToNextUsageMonthStart(base, usageMonths);
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

function collectRecurringEventRows(
  horizonStart: Date,
  horizonEnd: Date,
  usageMonths: number[],
  anchor: Date,
  spa: SpaProfileScheduleRow,
  recurringCatalog: MaintenanceCatalogRecurring[]
): Array<Record<string, unknown>> {
  const usage = new Set(usageMonths);
  const rows: Array<Record<string, unknown>> = [];

  for (let d = new Date(horizonStart.getTime()); d <= horizonEnd; d = addUtcDays(d, 1)) {
    const month = d.getUTCMonth() + 1;
    if (!usage.has(month)) continue;

    const dayIndex = diffUtcDays(anchor, d);
    if (dayIndex < 0) continue;

    for (const spec of recurringCatalog) {
      if ((dayIndex - spec.phase) % spec.intervalDays !== 0 || dayIndex < spec.phase) continue;

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

  await db.transaction(async (trx) => {
    await trx('maintenance_events')
      .where({ spa_profile_id: spaProfileId, source: 'auto' })
      .whereNull('completed_at')
      .where('due_date', '>=', todayKey)
      .del();

    const rows = collectRecurringEventRows(horizonStart, horizonEnd, usageMonths, anchor, spa, recurringCatalog).map((r) => ({
      ...r,
      created_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    }));

    if (rows.length > 0) {
      await trx('maintenance_events').insert(rows);
    }
  });
}

export function getCatalogIntervalForEventType(eventType: string): number | null {
  const spec = MAINTENANCE_RECURRING_CATALOG.find((r) => r.eventType === eventType);
  return spec ? spec.intervalDays : null;
}
