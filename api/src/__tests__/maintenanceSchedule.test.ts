import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseUsageMonths,
  computeNextRecurringDueDate,
  snapToNextUsageMonthStart,
} from '../services/maintenanceSchedule.service';

describe('parseUsageMonths', () => {
  it('defaults to full year when null or empty', () => {
    const full = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    assert.deepEqual(parseUsageMonths(null), full);
    assert.deepEqual(parseUsageMonths(undefined), full);
    assert.deepEqual(parseUsageMonths([]), full);
  });

  it('parses valid subset and sorts', () => {
    assert.deepEqual(parseUsageMonths([8, 6, 7]), [6, 7, 8]);
  });

  it('parses JSON string array', () => {
    assert.deepEqual(parseUsageMonths('[9,10,11]'), [9, 10, 11]);
  });
});

describe('snapToNextUsageMonthStart', () => {
  it('returns same day when month is in use', () => {
    const d = new Date(Date.UTC(2026, 5, 15));
    const out = snapToNextUsageMonthStart(d, [6, 7, 8]);
    assert.equal(out.getUTCFullYear(), 2026);
    assert.equal(out.getUTCMonth(), 5);
    assert.equal(out.getUTCDate(), 15);
  });

  it('advances to next in-use month', () => {
    const d = new Date(Date.UTC(2026, 0, 22));
    const out = snapToNextUsageMonthStart(d, [6, 7, 8]);
    assert.equal(out.getUTCFullYear(), 2026);
    assert.equal(out.getUTCMonth(), 5);
    assert.equal(out.getUTCDate(), 1);
  });
});

describe('computeNextRecurringDueDate', () => {
  it('adds interval days then snaps to usage window', () => {
    const completed = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
    const out = computeNextRecurringDueDate(completed, 7, [6, 7, 8]);
    assert.equal(out.getUTCFullYear(), 2026);
    assert.equal(out.getUTCMonth(), 5);
    assert.equal(out.getUTCDate(), 1);
  });
});
