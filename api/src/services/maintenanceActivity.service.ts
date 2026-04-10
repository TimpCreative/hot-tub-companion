import type { Knex } from 'knex';
import { db } from '../config/database';

export type MaintenanceActivityAction =
  | 'created'
  | 'completed'
  | 'snoozed'
  | 'rescheduled'
  | 'deleted'
  | 'superseded';

export interface MaintenanceActivityRow {
  id: string;
  spaProfileId: string;
  userId: string;
  tenantId: string;
  maintenanceEventId: string | null;
  action: MaintenanceActivityAction | string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

function mapActivityRow(row: Record<string, unknown>): MaintenanceActivityRow {
  return {
    id: row.id as string,
    spaProfileId: row.spa_profile_id as string,
    userId: row.user_id as string,
    tenantId: row.tenant_id as string,
    maintenanceEventId: (row.maintenance_event_id as string | null) ?? null,
    action: row.action as string,
    payload: (typeof row.payload === 'object' && row.payload !== null ? row.payload : {}) as Record<string, unknown>,
    createdAt: row.created_at as Date,
  };
}

export async function insertMaintenanceActivity(
  input: {
    spaProfileId: string;
    userId: string;
    tenantId: string;
    maintenanceEventId?: string | null;
    action: MaintenanceActivityAction | string;
    payload?: Record<string, unknown>;
  },
  trx: Knex | Knex.Transaction = db
): Promise<void> {
  await trx('maintenance_activity').insert({
    spa_profile_id: input.spaProfileId,
    user_id: input.userId,
    tenant_id: input.tenantId,
    maintenance_event_id: input.maintenanceEventId ?? null,
    action: input.action,
    payload: input.payload ?? {},
    created_at: trx.fn.now(),
  });
}

export async function listMaintenanceActivity(params: {
  spaProfileId: string;
  userId: string;
  tenantId: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: MaintenanceActivityRow[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));

  const base = db('maintenance_activity')
    .where({
      spa_profile_id: params.spaProfileId,
      user_id: params.userId,
      tenant_id: params.tenantId,
    })
    .orderBy('created_at', 'desc');

  const countRow = await base.clone().count('* as c').first();
  const total = parseInt(String((countRow as { c?: string })?.c ?? '0'), 10);

  const rows = await base.clone().limit(pageSize).offset((page - 1) * pageSize);

  return {
    items: rows.map((r) => mapActivityRow(r as Record<string, unknown>)),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}
