import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planFilterMaintenanceEvents } from '../services/filterMaintenancePlanner';
import { computeNextRecurringDueDate, formatDateKey } from '../services/maintenanceDateUtils';

const FULL_YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

describe('planFilterMaintenanceEvents', () => {
  const horizonStart = new Date(Date.UTC(2026, 0, 1));
  const horizonEnd = new Date(Date.UTC(2026, 5, 30));
  const spaCreatedAt = new Date(Date.UTC(2026, 0, 1));

  const rinse = {
    intervalDays: 14,
    notificationDaysBefore: 1,
    linkedProductCategory: 'filter' as const,
  };
  const deep = {
    intervalDays: 90,
    notificationDaysBefore: 3,
    linkedProductCategory: 'filter' as const,
  };
  const replace = {
    intervalDays: 365,
    notificationDaysBefore: 7,
    linkedProductCategory: 'filter' as const,
  };

  it('removes deep clean dates in the half-D window before a replace due', () => {
    const planned = planFilterMaintenanceEvents({
      horizonStart,
      horizonEnd,
      usageMonths: FULL_YEAR,
      spaCreatedAt,
      lastCompleted: {},
      rinse,
      deep,
      replace: { ...replace, intervalDays: 60 },
      applyPreReplaceRinseSuppression: true,
    });
    const replaceDates = planned.filter((p) => p.eventType === 'filter_replace').map((p) => formatDateKey(p.due));
    const deepDates = planned.filter((p) => p.eventType === 'filter_deep_clean').map((p) => formatDateKey(p.due));
    assert.ok(replaceDates.includes('2026-03-02'));
    assert.ok(!deepDates.includes('2026-02-17'));
  });

  it('when applyPreReplaceRinseSuppression is false, keeps rinses in the pre-replace window', () => {
    const withSuppression = planFilterMaintenanceEvents({
      horizonStart,
      horizonEnd,
      usageMonths: FULL_YEAR,
      spaCreatedAt,
      lastCompleted: {},
      rinse: { ...rinse, intervalDays: 7 },
      deep,
      replace: { ...replace, intervalDays: 30 },
      applyPreReplaceRinseSuppression: true,
    });
    const withoutSuppression = planFilterMaintenanceEvents({
      horizonStart,
      horizonEnd,
      usageMonths: FULL_YEAR,
      spaCreatedAt,
      lastCompleted: {},
      rinse: { ...rinse, intervalDays: 7 },
      deep,
      replace: { ...replace, intervalDays: 30 },
      applyPreReplaceRinseSuppression: false,
    });
    const rinseKeys = (p: typeof withSuppression) =>
      p.filter((x) => x.eventType === 'filter_rinse').map((x) => formatDateKey(x.due));
    assert.ok(rinseKeys(withSuppression).length < rinseKeys(withoutSuppression).length);
  });

  it('after deep vs rinse pass, at least one rinse lands R days after a deep due (replace far out)', () => {
    const planned = planFilterMaintenanceEvents({
      horizonStart,
      horizonEnd,
      usageMonths: FULL_YEAR,
      spaCreatedAt,
      lastCompleted: {},
      rinse: { ...rinse, intervalDays: 7 },
      deep: { ...deep, intervalDays: 28 },
      replace: { ...replace, intervalDays: 300 },
      applyPreReplaceRinseSuppression: true,
    });
    const deeps = planned.filter((p) => p.eventType === 'filter_deep_clean');
    assert.ok(deeps.length > 0);
    let matched = false;
    for (const d of deeps) {
      const want = formatDateKey(computeNextRecurringDueDate(d.due, 7, FULL_YEAR));
      if (planned.some((p) => p.eventType === 'filter_rinse' && formatDateKey(p.due) === want)) {
        matched = true;
        break;
      }
    }
    assert.ok(matched);
  });

  it('respects custom intervals for pre-replace window (R from rinse spec)', () => {
    const planned = planFilterMaintenanceEvents({
      horizonStart,
      horizonEnd,
      usageMonths: FULL_YEAR,
      spaCreatedAt,
      lastCompleted: {},
      rinse: { ...rinse, intervalDays: 10 },
      deep,
      replace: { ...replace, intervalDays: 40 },
      applyPreReplaceRinseSuppression: true,
    });
    const replaceDue = planned.find((p) => p.eventType === 'filter_replace' && formatDateKey(p.due) === '2026-02-10');
    assert.ok(replaceDue);
    const rinsesBefore = planned
      .filter((p) => p.eventType === 'filter_rinse')
      .map((p) => formatDateKey(p.due))
      .filter((k) => k >= '2026-01-31' && k < '2026-02-10');
    assert.equal(rinsesBefore.length, 0);
  });
});
