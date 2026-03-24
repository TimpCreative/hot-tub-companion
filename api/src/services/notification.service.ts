/**
 * Push notification service. Sends via Firebase Cloud Messaging.
 * NEVER exposes fcm_token to callers or logs.
 */

import { db } from '../config/database';
import { getFirebaseMessaging } from '../config/firebase';

const PREF_KEYS = ['maintenance', 'orders', 'subscriptions', 'service', 'promotional'] as const;
type PrefKey = (typeof PREF_KEYS)[number];

function prefColumn(key: PrefKey): string {
  return `notification_pref_${key}`;
}

async function getUserWithToken(
  userId: string,
  tenantId: string,
  prefKey?: PrefKey
): Promise<{ id: string; fcm_token: string | null } | null> {
  const cols = ['id', 'fcm_token'];
  if (prefKey) cols.push(prefColumn(prefKey));
  const row = await db('users')
    .select(cols)
    .where({ id: userId, tenant_id: tenantId })
    .whereNull('deleted_at')
    .first();
  if (!row) return null;
  if (prefKey && row[prefColumn(prefKey)] === false) return null;
  if (!row.fcm_token || typeof row.fcm_token !== 'string') return null;
  return { id: row.id, fcm_token: row.fcm_token };
}

async function getTenantCustomerTokens(
  tenantId: string,
  prefKey: PrefKey = 'promotional'
): Promise<{ id: string; fcm_token: string }[]> {
  const rows = await db('users')
    .select('id', 'fcm_token')
    .where({ tenant_id: tenantId })
    .whereNull('deleted_at')
    .whereNotNull('fcm_token')
    .where(prefColumn(prefKey), true);
  return rows
    .filter((r) => r.fcm_token && typeof r.fcm_token === 'string')
    .map((r) => ({ id: r.id, fcm_token: r.fcm_token as string }));
}

export async function logNotification(params: {
  tenantId?: string | null;
  recipientUserId?: string | null;
  title: string;
  body?: string | null;
  type: string;
  createdByType?: string | null;
  createdById?: string | null;
}): Promise<void> {
  await db('notification_log').insert({
    tenant_id: params.tenantId ?? null,
    recipient_user_id: params.recipientUserId ?? null,
    title: params.title,
    body: params.body ?? null,
    type: params.type,
    created_by_type: params.createdByType ?? null,
    created_by_id: params.createdById ?? null,
  });
}

export async function sendToUser(
  userId: string,
  tenantId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  prefKey?: PrefKey,
  logParams?: { type: string; createdByType?: string; createdById?: string }
): Promise<boolean> {
  const user = await getUserWithToken(userId, tenantId, prefKey);
  if (!user?.fcm_token) return false;

  const messaging = getFirebaseMessaging();
  const payload: import('firebase-admin/messaging').Message = {
    token: user.fcm_token,
    notification: { title, body },
    data: data ? stringifyData(data) : undefined,
    android: { priority: 'high' as const },
    apns: { payload: { aps: { sound: 'default' } } },
  };

  try {
    await messaging.send(payload);
    if (logParams) {
      await logNotification({
        tenantId,
        recipientUserId: userId,
        title,
        body,
        type: logParams.type,
        createdByType: logParams.createdByType,
        createdById: logParams.createdById,
      });
    }
    return true;
  } catch (err) {
    console.warn('[notification] sendToUser failed:', userId, err instanceof Error ? err.message : err);
    return false;
  }
}

function stringifyData(data: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? v : String(v)])
  );
}

export async function sendToTenantCustomers(
  tenantId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  prefKey: PrefKey = 'promotional',
  logParams?: { type: string; createdByType?: string; createdById?: string }
): Promise<{ sent: number; failed: number }> {
  const users = await getTenantCustomerTokens(tenantId, prefKey);
  if (users.length === 0) return { sent: 0, failed: 0 };

  const messaging = getFirebaseMessaging();
  const tokens = users.map((u) => u.fcm_token);
  const strData = data ? stringifyData(data) : undefined;

  const message: import('firebase-admin/messaging').MulticastMessage = {
    tokens,
    notification: { title, body },
    data: strData,
    android: { priority: 'high' as const },
    apns: { payload: { aps: { sound: 'default' } } },
  };

  let sent = 0;
  let failed = 0;

  try {
    const res = await messaging.sendEachForMulticast(message);
    sent = res.successCount;
    failed = res.failureCount;
    if (logParams && sent > 0) {
      for (let i = 0; i < res.responses.length; i++) {
        if (res.responses[i].success && users[i]) {
          await logNotification({
            tenantId,
            recipientUserId: users[i].id,
            title,
            body,
            type: logParams.type,
            createdByType: logParams.createdByType,
            createdById: logParams.createdById,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[notification] sendToTenantCustomers failed:', tenantId, err instanceof Error ? err.message : err);
    failed = users.length;
  }

  return { sent, failed };
}

export async function sendToAllCustomers(
  tenantIds: string[] | undefined,
  title: string,
  body: string,
  data?: Record<string, string>,
  prefKey: PrefKey = 'promotional',
  logParams?: { type: string; createdByType?: string; createdById?: string }
): Promise<{ sent: number; failed: number }> {
  let query = db('users')
    .select('id', 'tenant_id', 'fcm_token')
    .whereNull('deleted_at')
    .whereNotNull('fcm_token')
    .where(prefColumn(prefKey), true);

  if (tenantIds && tenantIds.length > 0) {
    query = query.whereIn('tenant_id', tenantIds);
  }

  const rows = (await query) as { id: string; tenant_id: string; fcm_token: string }[];
  const valid = rows.filter((r) => r.fcm_token && typeof r.fcm_token === 'string');
  if (valid.length === 0) return { sent: 0, failed: 0 };

  const messaging = getFirebaseMessaging();
  const tokens = valid.map((r) => r.fcm_token);
  const strData = data ? stringifyData(data) : undefined;

  const message: import('firebase-admin/messaging').MulticastMessage = {
    tokens,
    notification: { title, body },
    data: strData,
    android: { priority: 'high' as const },
    apns: { payload: { aps: { sound: 'default' } } },
  };

  let sent = 0;
  let failed = 0;

  try {
    const res = await messaging.sendEachForMulticast(message);
    sent = res.successCount;
    failed = res.failureCount;
    if (logParams && sent > 0) {
      for (let i = 0; i < res.responses.length; i++) {
        if (res.responses[i].success && valid[i]) {
          await logNotification({
            tenantId: valid[i].tenant_id,
            recipientUserId: valid[i].id,
            title,
            body,
            type: logParams.type,
            createdByType: logParams.createdByType,
            createdById: logParams.createdById,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[notification] sendToAllCustomers failed:', err instanceof Error ? err.message : err);
    failed = valid.length;
  }

  return { sent, failed };
}

/** Welcome notification after first spa registration. Uses promotional pref. */
export async function sendWelcomeNotification(
  userId: string,
  tenantId: string,
  tenantName: string,
  modelName: string
): Promise<boolean> {
  const title = 'Welcome!';
  const body = `Welcome to ${tenantName}! Your ${modelName || 'spa'} is all set up. 🎉`;
  return sendToUser(userId, tenantId, title, body, undefined, 'promotional', {
    type: 'welcome',
    createdByType: 'system',
    createdById: 'welcome',
  });
}
