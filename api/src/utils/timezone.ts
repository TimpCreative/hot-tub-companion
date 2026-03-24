/**
 * Convert a local date+time in a given timezone to a UTC Date.
 * @param dateStr "YYYY-MM-DD"
 * @param timeStr "HH:mm" (24h)
 * @param timezone IANA timezone e.g. "America/Denver"
 */
export function localToUTC(dateStr: string, timeStr: string, timezone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hours, mins] = timeStr.split(':').map(Number);
  const m1 = (m ?? 1) - 1;

  let low = Date.UTC(y, m1, d, 0, 0, 0);
  let high = Date.UTC(y, m1, d + 2, 0, 0, 0);

  const targetLocal = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  const targetDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  for (let i = 0; i < 50; i++) {
    const mid = Math.floor((low + high) / 2);
    const candidate = new Date(mid);
    const str = candidate.toLocaleString('en-CA', { timeZone: timezone, hour12: false });
    const [datePart, timePart] = str.split(',').map((s) => s.trim());
    const localDate = datePart || '';
    const [h, m] = (timePart || '').split(':').map(Number);
    const localTime = `${String(h ?? 0).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;

    if (localDate === targetDate && localTime === targetLocal) {
      return candidate;
    }
    if (localDate < targetDate || (localDate === targetDate && localTime < targetLocal)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const fallback = new Date(Date.UTC(y, m1, d, hours, mins, 0));
  return fallback;
}

/**
 * Add days to a date string YYYY-MM-DD.
 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const d2 = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days));
  return d2.toISOString().slice(0, 10);
}
