/**
 * Generates and refreshes auto maintenance_events from spa usage_months and winter_strategy.
 * Date math uses UTC calendar dates (v1).
 */

import { db } from '../config/database';

export type WinterStrategy = 'shutdown' | 'operate';

export type SpaProfileScheduleRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  usage_months: number[] | string | null;
  winter_strategy: WinterStrategy | string | null;
  created_at: Date | string;
};

type CatalogRecurring = {
  eventType: string;
  intervalDays: number;
  phase: number;
  notificationDaysBefore: number;
  linkedProductCategory: string | null;
};

const EVENT_COPY: Record<string, { title: string; description: string }> = {
  filter_rinse: {
    title: 'Rinse the filter',
    description: 'Quick rinse removes debris and helps flow between deep cleans.',
  },
  filter_deep_clean: {
    title: 'Deep clean the filter',
    description: 'Soak or spray per manufacturer directions to restore filter media.',
  },
  filter_replace: {
    title: 'Replace the filter cartridge',
    description: 'Annual replacement keeps water clear and protects the pump.',
  },
  drain_refill: {
    title: 'Drain and refill',
    description: 'Fresh water resets dissolved solids and improves sanitizer performance.',
  },
  cover_check: {
    title: 'Check the cover',
    description: 'Inspect vinyl, seams, and locks; treat or replace if waterlogged.',
  },
  water_test: {
    title: 'Test your water',
    description: 'Log a water test to keep chemistry in range.',
  },
  winterize: {
    title: 'Winterize the spa',
    description: 'Drain, blow lines, and protect equipment before the off season.',
  },
  spring_startup: {
    title: 'Spring startup',
    description: 'Refill, balance water, and restart circulation after the off season.',
  },
};

const RECURRING_CATALOG: CatalogRecurring[] = [
  { eventType: 'filter_rinse', intervalDays: 14, phase: 0, notificationDaysBefore: 1, linkedProductCategory: 'filter' },
  { eventType: 'filter_deep_clean', intervalDays: 90, phase: 3, notificationDaysBefore: 3, linkedProductCategory: 'filter' },
  { eventType: 'filter_replace', intervalDays: 365, phase: 7, notificationDaysBefore: 7, linkedProductCategory: 'filter' },
  { eventType: 'drain_refill', intervalDays: 90, phase: 21, notificationDaysBefore: 5, linkedProductCategory: 'chemical' },
  { eventType: 'cover_check', intervalDays: 180, phase: 10, notificationDaysBefore: 3, linkedProductCategory: 'cover' },
  { eventType: 'water_test', intervalDays: 7, phase: 0, notificationDaysBefore: 1, linkedProductCategory: 'chemical' },
];

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
  spa: SpaProfileScheduleRow
): Array<Record<string, unknown>> {
  const usage = new Set(usageMonths);
  const rows: Array<Record<string, unknown>> = [];

  for (let d = new Date(horizonStart.getTime()); d <= horizonEnd; d = addUtcDays(d, 1)) {
    const month = d.getUTCMonth() + 1;
    if (!usage.has(month)) continue;

    const dayIndex = diffUtcDays(anchor, d);
    if (dayIndex < 0) continue;

    for (const spec of RECURRING_CATALOG) {
      if ((dayIndex - spec.phase) % spec.intervalDays !== 0 || dayIndex < spec.phase) continue;

      const copy = EVENT_COPY[spec.eventType];
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
    const copy = EVENT_COPY[t.eventType];
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

    const rows = collectRecurringEventRows(horizonStart, horizonEnd, usageMonths, anchor, spa).map((r) => ({
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
  const spec = RECURRING_CATALOG.find((r) => r.eventType === eventType);
  return spec ? spec.intervalDays : null;
}
