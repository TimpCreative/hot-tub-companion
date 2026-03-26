import crypto from 'crypto';
import type { Request } from 'express';
import { db } from '../config/database';

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function logNotificationSecurityEvent(params: {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  eventType: string;
  outcome: 'success' | 'failure' | 'blocked';
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db('notification_security_audit').insert({
      tenant_id: params.tenantId || null,
      actor_user_id: params.actorUserId || null,
      actor_email: params.actorEmail || null,
      actor_role: params.actorRole || null,
      event_type: params.eventType,
      outcome: params.outcome,
      request_id: params.requestId || null,
      ip_hash: params.ip ? sha256(params.ip) : null,
      user_agent_hash: params.userAgent ? sha256(params.userAgent) : null,
      details: params.details ?? null,
    });
  } catch (err) {
    console.error('Failed to write notification security audit log:', err);
  }
}

export function requestAuditContext(req: Request): {
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
} {
  return {
    requestId: (req as Request & { requestId?: string }).requestId ?? null,
    ip: req.ip || null,
    userAgent: req.get('user-agent') || null,
  };
}
