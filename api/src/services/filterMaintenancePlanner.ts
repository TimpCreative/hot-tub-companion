import type { FilterChainEventType } from './maintenanceCatalog';
import {
  addUtcDays,
  computeNextRecurringDueDate,
  formatDateKey,
  utcDateOnly,
} from './maintenanceDateUtils';

export type LastCompletedMap = Partial<Record<FilterChainEventType, Date>>;

export type FilterEventSpec = {
  intervalDays: number;
  notificationDaysBefore: number;
  linkedProductCategory: string | null;
};

export type FilterPlannerInput = {
  horizonStart: Date;
  horizonEnd: Date;
  usageMonths: number[];
  spaCreatedAt: Date;
  lastCompleted: LastCompletedMap;
  rinse?: FilterEventSpec;
  deep?: FilterEventSpec;
  replace?: FilterEventSpec;
  /** When false, skip removing rinses before replace (e.g. overdue incomplete replace). */
  applyPreReplaceRinseSuppression: boolean;
};

export type PlannedFilterEvent = {
  eventType: FilterChainEventType;
  due: Date;
  intervalDays: number;
  notificationDaysBefore: number;
  linkedProductCategory: string | null;
};

function buildCandidateDates(
  lastCompleted: Date | undefined,
  createdAt: Date,
  intervalDays: number,
  usageMonths: number[],
  horizonStart: Date,
  horizonEnd: Date
): Date[] {
  const anchor = lastCompleted ?? createdAt;
  let next = computeNextRecurringDueDate(anchor, intervalDays, usageMonths);
  while (next < horizonStart) {
    next = computeNextRecurringDueDate(next, intervalDays, usageMonths);
  }
  const out: Date[] = [];
  while (next <= horizonEnd) {
    out.push(utcDateOnly(next));
    next = computeNextRecurringDueDate(next, intervalDays, usageMonths);
  }
  return out;
}

function mergeDateSet(dates: Date[]): Date[] {
  const keys = new Set(dates.map((d) => formatDateKey(d)));
  return [...keys]
    .sort()
    .map((k) => {
      const [y, m, day] = k.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, day));
    });
}

/**
 * Completion-driven filter rinse / deep clean / replace with replace > deep > rinse precedence.
 */
export function planFilterMaintenanceEvents(input: FilterPlannerInput): PlannedFilterEvent[] {
  const { horizonStart, horizonEnd, usageMonths, spaCreatedAt, lastCompleted, applyPreReplaceRinseSuppression } = input;
  const created = utcDateOnly(spaCreatedAt);

  let datesR = input.rinse
    ? buildCandidateDates(
        lastCompleted.filter_rinse,
        created,
        input.rinse.intervalDays,
        usageMonths,
        horizonStart,
        horizonEnd
      )
    : [];
  let datesD = input.deep
    ? buildCandidateDates(
        lastCompleted.filter_deep_clean,
        created,
        input.deep.intervalDays,
        usageMonths,
        horizonStart,
        horizonEnd
      )
    : [];
  const datesY = input.replace
    ? buildCandidateDates(
        lastCompleted.filter_replace,
        created,
        input.replace.intervalDays,
        usageMonths,
        horizonStart,
        horizonEnd
      )
    : [];

  const R = input.rinse?.intervalDays ?? 14;
  const D = input.deep?.intervalDays ?? 90;

  // 1) Replace vs deep clean: drop deep clean in [y - floor(D/2), y)
  if (input.replace && input.deep && datesY.length > 0) {
    const halfD = Math.floor(D / 2);
    for (const y of datesY) {
      const yMinHalf = addUtcDays(y, -halfD);
      datesD = datesD.filter((d) => !(d >= yMinHalf && d < y));
    }
  }

  // 2) Replace vs rinse: drop rinse in [y - R, y) when allowed
  if (input.replace && input.rinse && applyPreReplaceRinseSuppression && datesY.length > 0) {
    for (const y of datesY) {
      const yMinR = addUtcDays(y, -R);
      datesR = datesR.filter((r) => !(r >= yMinR && r < y));
    }
  }

  // 3) Deep clean vs rinse: drop rinse in [d - R, d + R]; ensure rinse R days after each deep due
  if (input.deep && input.rinse && datesD.length > 0) {
    let workingR = [...datesR];
    for (const d of datesD) {
      const dMinR = addUtcDays(d, -R);
      const dPlusR = addUtcDays(d, R);
      workingR = workingR.filter((r) => !(r >= dMinR && r <= dPlusR));
      const afterDeep = computeNextRecurringDueDate(d, input.rinse.intervalDays, usageMonths);
      if (afterDeep >= horizonStart && afterDeep <= horizonEnd) {
        workingR.push(utcDateOnly(afterDeep));
      }
    }
    datesR = mergeDateSet(workingR);
  }

  const out: PlannedFilterEvent[] = [];
  for (const d of datesR) {
    if (!input.rinse) continue;
    out.push({
      eventType: 'filter_rinse',
      due: d,
      intervalDays: input.rinse.intervalDays,
      notificationDaysBefore: input.rinse.notificationDaysBefore,
      linkedProductCategory: input.rinse.linkedProductCategory,
    });
  }
  for (const d of datesD) {
    if (!input.deep) continue;
    out.push({
      eventType: 'filter_deep_clean',
      due: d,
      intervalDays: input.deep.intervalDays,
      notificationDaysBefore: input.deep.notificationDaysBefore,
      linkedProductCategory: input.deep.linkedProductCategory,
    });
  }
  for (const d of datesY) {
    if (!input.replace) continue;
    out.push({
      eventType: 'filter_replace',
      due: d,
      intervalDays: input.replace.intervalDays,
      notificationDaysBefore: input.replace.notificationDaysBefore,
      linkedProductCategory: input.replace.linkedProductCategory,
    });
  }

  return out;
}
