import type { Knex } from 'knex';
import { db } from '../config/database';
import { insertMaintenanceActivity } from './maintenanceActivity.service';

function dueDateStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  return String(v).slice(0, 10);
}

/**
 * For each auto event_type, keep a single pending row (latest due_date). Deletes older duplicates and logs superseded.
 */
export async function dedupePendingAutoEventsByEventType(
  spaProfileId: string,
  trx: Knex | Knex.Transaction = db
): Promise<number> {
  const pending = (await trx('maintenance_events')
    .where({
      spa_profile_id: spaProfileId,
      source: 'auto',
    })
    .whereNull('completed_at')
    .whereNull('deleted_at')
    .select('id', 'event_type', 'due_date', 'user_id', 'tenant_id', 'title')) as {
    id: string;
    event_type: string;
    due_date: string | Date;
    user_id: string;
    tenant_id: string;
    title: string;
  }[];

  const byType = new Map<string, typeof pending>();
  for (const row of pending) {
    const list = byType.get(row.event_type) ?? [];
    list.push(row);
    byType.set(row.event_type, list);
  }

  let removed = 0;
  for (const [, rows] of byType) {
    if (rows.length <= 1) continue;
    const sorted = [...rows].sort((a, b) => dueDateStr(a.due_date).localeCompare(dueDateStr(b.due_date)));
    const keep = sorted[sorted.length - 1];
    for (const r of sorted) {
      if (r.id === keep.id) continue;
      await insertMaintenanceActivity(
        {
          spaProfileId,
          userId: r.user_id,
          tenantId: r.tenant_id,
          maintenanceEventId: r.id,
          action: 'superseded',
          payload: {
            title: r.title,
            eventType: r.event_type,
            removedDueDate: dueDateStr(r.due_date),
            keptEventId: keep.id,
            keptDueDate: dueDateStr(keep.due_date),
          },
        },
        trx
      );
      await trx('maintenance_events').where({ id: r.id }).del();
      removed += 1;
    }
  }
  return removed;
}

/** If any auto event_type has multiple pending rows, collapse to latest due_date (list/read heal). */
export async function healAutoDuplicatesIfNeeded(spaProfileId: string): Promise<void> {
  const groups = (await db('maintenance_events')
    .where({ spa_profile_id: spaProfileId, source: 'auto' })
    .whereNull('completed_at')
    .whereNull('deleted_at')
    .groupBy('event_type')
    .select('event_type')
    .count('* as cnt')) as { event_type: string; cnt: string | number }[];

  for (const g of groups) {
    const n = typeof g.cnt === 'string' ? parseInt(g.cnt, 10) : g.cnt;
    if (n > 1) {
      await dedupePendingAutoEventsByEventType(spaProfileId);
      return;
    }
  }
}
