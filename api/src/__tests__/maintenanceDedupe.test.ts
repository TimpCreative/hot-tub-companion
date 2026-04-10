import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors dueDateStr in maintenanceDedupe.service for ordering. */
function dueDateStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  return String(v).slice(0, 10);
}

function pickKeepId(rows: Array<{ id: string; due_date: string }>, today: string): string {
  const sorted = [...rows].sort((a, b) => dueDateStr(a.due_date).localeCompare(dueDateStr(b.due_date)));
  const firstUpcoming = sorted.find((r) => dueDateStr(r.due_date) >= today);
  return (firstUpcoming ?? sorted[sorted.length - 1]).id;
}

describe('maintenance dedupe date ordering', () => {
  it('sorts ISO and plain date keys consistently', () => {
    const rows = [
      { id: 'a', due_date: '2026-04-07T00:00:00.000Z' },
      { id: 'b', due_date: '2026-04-14' },
      { id: 'c', due_date: '2026-04-01' },
    ];
    const sorted = [...rows].sort((a, b) => dueDateStr(a.due_date).localeCompare(dueDateStr(b.due_date)));
    assert.equal(sorted[0].id, 'c');
    assert.equal(sorted[2].id, 'b');
  });

  it('keeps the nearest upcoming due date when multiple pending rows exist', () => {
    const rows = [
      { id: 'a', due_date: '2026-04-07' },
      { id: 'b', due_date: '2026-04-14' },
      { id: 'c', due_date: '2026-05-01' },
    ];
    assert.equal(pickKeepId(rows, '2026-04-10'), 'b');
  });

  it('keeps latest overdue when no upcoming rows exist', () => {
    const rows = [
      { id: 'a', due_date: '2026-04-01' },
      { id: 'b', due_date: '2026-04-07' },
    ];
    assert.equal(pickKeepId(rows, '2026-04-10'), 'b');
  });
});
