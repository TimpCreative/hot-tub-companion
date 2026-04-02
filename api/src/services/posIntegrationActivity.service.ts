import type { Request } from 'express';
import { db } from '../config/database';

export function retailerPosActivityActor(req: Request): {
  actorUserId: string | null;
  actorLabel: string | null;
} {
  const u = req.user as { id?: string; email?: string } | undefined;
  if (!u?.id) return { actorUserId: null, actorLabel: null };
  const actorUserId = String(u.id).startsWith('admin_') ? null : u.id;
  return { actorUserId, actorLabel: u.email ?? null };
}

export type PosIntegrationActivitySource =
  | 'retailer_admin'
  | 'super_admin'
  | 'webhook'
  | 'cron'
  | 'system';

export interface PosIntegrationActivityItem {
  id: string;
  eventType: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  source: string;
  actorUserId: string | null;
  actorLabel: string | null;
  createdAt: Date | string;
}

export async function logPosIntegrationActivity(
  tenantId: string,
  params: {
    eventType: string;
    summary: string;
    metadata?: Record<string, unknown> | null;
    source: PosIntegrationActivitySource;
    actorUserId?: string | null;
    actorLabel?: string | null;
  }
): Promise<void> {
  const now = new Date();
  try {
    await db.transaction(async (trx) => {
      await trx('pos_integration_activity').insert({
        tenant_id: tenantId,
        event_type: params.eventType.slice(0, 64),
        summary: params.summary.slice(0, 500),
        metadata: params.metadata ?? null,
        source: params.source,
        actor_user_id: params.actorUserId ?? null,
        actor_label: params.actorLabel ? params.actorLabel.slice(0, 320) : null,
        created_at: now,
      });
      await trx('tenants').where({ id: tenantId }).update({
        pos_integration_last_activity_at: now,
        updated_at: trx.fn.now(),
      });
    });
  } catch (err) {
    console.warn('[posIntegrationActivity] log failed:', err);
  }
}

export async function listPosIntegrationActivity(
  tenantId: string,
  page: number,
  pageSize: number
): Promise<{ items: PosIntegrationActivityItem[]; total: number }> {
  const p = Math.max(1, Math.floor(page));
  const ps = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const offset = (p - 1) * ps;

  const countRow = await db('pos_integration_activity')
    .where({ tenant_id: tenantId })
    .count<{ count: string }>('* as count')
    .first();
  const total = parseInt(countRow?.count ?? '0', 10);

  const rows = await db('pos_integration_activity')
    .where({ tenant_id: tenantId })
    .orderBy('created_at', 'desc')
    .offset(offset)
    .limit(ps)
    .select(
      'id',
      'event_type',
      'summary',
      'metadata',
      'source',
      'actor_user_id',
      'actor_label',
      'created_at'
    );

  const items: PosIntegrationActivityItem[] = rows.map((r) => ({
    id: r.id as string,
    eventType: r.event_type as string,
    summary: r.summary as string,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    source: r.source as string,
    actorUserId: (r.actor_user_id as string | null) ?? null,
    actorLabel: (r.actor_label as string | null) ?? null,
    createdAt: r.created_at as Date,
  }));

  return { items, total };
}
