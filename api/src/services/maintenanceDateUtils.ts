/** Shared UTC calendar helpers for maintenance scheduling (used by schedule + filter planner). */

export function utcDateOnly(d: Date | string): Date {
  const x = typeof d === 'string' ? new Date(d) : d;
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

export function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

export function diffUtcDays(earlier: Date, later: Date): number {
  const a = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate());
  const b = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
  return Math.floor((b - a) / 86400000);
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

/** Next recurring due: anchor date + interval, snapped into an in-use month. */
export function computeNextRecurringDueDate(
  anchorUtc: Date,
  intervalDays: number,
  usageMonths: number[]
): Date {
  const base = addUtcDays(utcDateOnly(anchorUtc), intervalDays);
  return snapToNextUsageMonthStart(base, usageMonths);
}

export function formatDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
