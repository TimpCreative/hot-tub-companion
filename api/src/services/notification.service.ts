/**
 * Push notification service. Sends via Firebase Cloud Messaging.
 * NEVER exposes fcm_token to callers or logs.
 */

import { db } from '../config/database';
import { getFirebaseMessaging } from '../config/firebase';
import * as notificationSecurityAudit from './notificationSecurityAudit.service';
import * as expoPushSend from './expoPushSend.service';

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

export async function getTenantCustomerTokensWithTimezone(
  tenantId: string,
  retailerTimezone: string,
  prefKey: PrefKey = 'promotional'
): Promise<{ id: string; fcm_token: string; timezone: string }[]> {
  const rows = (await db('users')
    .select('id', 'fcm_token', 'timezone')
    .where({ tenant_id: tenantId })
    .whereNull('deleted_at')
    .whereNotNull('fcm_token')
    .where(prefColumn(prefKey), true)) as { id: string; fcm_token: string; timezone: string | null }[];
  return rows
    .filter((r) => r.fcm_token && typeof r.fcm_token === 'string')
    .map((r) => ({ id: r.id, fcm_token: r.fcm_token, timezone: r.timezone?.trim() || retailerTimezone }));
}

export async function getAlreadySentUserIds(scheduledNotificationId: string): Promise<Set<string>> {
  const rows = await db('notification_log')
    .where({ scheduled_notification_id: scheduledNotificationId })
    .whereNotNull('recipient_user_id')
    .select('recipient_user_id');
  return new Set(rows.map((r: { recipient_user_id: string }) => r.recipient_user_id));
}

/** Params persisted to notification_log on successful delivery only. */
export type NotificationLogParams = {
  type: string;
  createdByType?: string;
  createdById?: string;
  scheduledNotificationId?: string;
  /** Deep-link data (string values), mirrored from push payload. */
  payload?: Record<string, string> | null;
};

export async function logNotification(params: {
  tenantId?: string | null;
  recipientUserId?: string | null;
  title: string;
  body?: string | null;
  type: string;
  createdByType?: string | null;
  createdById?: string | null;
  scheduledNotificationId?: string | null;
  payload?: Record<string, string> | null;
}): Promise<void> {
  await db('notification_log').insert({
    tenant_id: params.tenantId ?? null,
    recipient_user_id: params.recipientUserId ?? null,
    title: params.title,
    body: params.body ?? null,
    type: params.type,
    created_by_type: params.createdByType ?? null,
    created_by_id: params.createdById ?? null,
    scheduled_notification_id: params.scheduledNotificationId ?? null,
    payload: params.payload ?? null,
  });
}

export async function sendToUser(
  userId: string,
  tenantId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  prefKey?: PrefKey,
  logParams?: NotificationLogParams
): Promise<boolean> {
  const user = await getUserWithToken(userId, tenantId, prefKey);
  if (!user?.fcm_token) return false;

  const strData = data ? stringifyData(data) : undefined;
  const logPayload = logParams?.payload ?? strData;

  if (expoPushSend.isExpoPushToken(user.fcm_token)) {
    try {
      const r = await expoPushSend.sendExpoPushToUsers(
        [{ id: userId, token: user.fcm_token }],
        title,
        body,
        strData,
        null
      );
      if (r.invalidUserIds.length > 0) await clearTokensForUsers(tenantId, r.invalidUserIds);
      if (r.sent > 0 && logParams) {
        await logNotification({
          tenantId,
          recipientUserId: userId,
          title,
          body,
          type: logParams.type,
          createdByType: logParams.createdByType,
          createdById: logParams.createdById,
          scheduledNotificationId: logParams.scheduledNotificationId ?? null,
          payload: logPayload ?? null,
        });
      }
      return r.sent > 0;
    } catch (err) {
      console.warn('[notification] sendToUser expo failed:', userId, err instanceof Error ? err.message : err);
      return false;
    }
  }

  const messaging = getFirebaseMessaging();
  const payload: import('firebase-admin/messaging').Message = {
    token: user.fcm_token,
    notification: { title, body },
    data: strData,
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
        scheduledNotificationId: logParams.scheduledNotificationId ?? null,
        payload: logPayload ?? null,
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

function isPermanentTokenFailure(code?: string | null): boolean {
  return code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered';
}

async function markInvalidTokens(
  tenantId: string,
  entries: { userId: string; code?: string | null; message?: string | null }[]
): Promise<void> {
  const invalidUserIds = entries.filter((e) => isPermanentTokenFailure(e.code)).map((e) => e.userId);
  if (invalidUserIds.length === 0) return;
  await db('users')
    .where({ tenant_id: tenantId })
    .whereIn('id', invalidUserIds)
    .update({
      fcm_token: null,
      fcm_token_updated_at: null,
      fcm_token_status: 'invalid',
      fcm_token_last_validated_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
}

async function clearTokensForUsers(tenantId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await db('users')
    .where({ tenant_id: tenantId })
    .whereIn('id', userIds)
    .update({
      fcm_token: null,
      fcm_token_updated_at: null,
      fcm_token_status: 'invalid',
      fcm_token_last_validated_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
}

export interface SendNotificationOptions {
  data?: Record<string, string>;
  imageUrl?: string;
}

interface DeliveryAuditContext {
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

function normalizeNotificationOptions(
  opts?: SendNotificationOptions | Record<string, string>
): { data?: Record<string, string>; imageUrl?: string } {
  if (!opts || typeof opts !== 'object') return {};
  if ('imageUrl' in opts || 'data' in opts) {
    return { data: (opts as SendNotificationOptions).data, imageUrl: (opts as SendNotificationOptions).imageUrl };
  }
  return { data: opts as Record<string, string> };
}

export async function sendToTenantCustomers(
  tenantId: string,
  title: string,
  body: string,
  opts?: SendNotificationOptions | Record<string, string>,
  prefKey: PrefKey = 'promotional',
  logParams?: NotificationLogParams,
  auditContext?: DeliveryAuditContext
): Promise<{ sent: number; failed: number }> {
  const users = await getTenantCustomerTokens(tenantId, prefKey);
  if (users.length === 0) return { sent: 0, failed: 0 };

  const { data: finalData, imageUrl } = normalizeNotificationOptions(opts);
  const strData = finalData ? stringifyData(finalData) : undefined;
  const logPayload = finalData ? stringifyData(finalData) : null;

  const expoUsers = users.filter((u) => expoPushSend.isExpoPushToken(u.fcm_token));
  const fcmUsers = users.filter((u) => !expoPushSend.isExpoPushToken(u.fcm_token));

  let sent = 0;
  let failed = 0;

  if (fcmUsers.length > 0) {
    const messaging = getFirebaseMessaging();
    const tokens = fcmUsers.map((u) => u.fcm_token);
    const notification: Record<string, string> = { title, body };
    if (imageUrl?.trim()) (notification as any).imageUrl = imageUrl.trim();
    const apnsConfig: import('firebase-admin/messaging').ApnsConfig = {
      payload: { aps: { sound: 'default', ...(imageUrl ? { 'mutable-content': 1 } : {}) } },
    };
    if (imageUrl?.trim()) (apnsConfig as any).fcmOptions = { imageUrl: imageUrl.trim() };
    const message: import('firebase-admin/messaging').MulticastMessage = {
      tokens,
      notification,
      data: strData,
      android: { priority: 'high' as const },
      apns: apnsConfig,
    };
    try {
      const res = await messaging.sendEachForMulticast(message);
      sent += res.successCount;
      failed += res.failureCount;
      await markInvalidTokens(
        tenantId,
        res.responses
          .map((r, i) => ({ response: r, user: fcmUsers[i] }))
          .filter((x) => !x.response.success && x.user)
          .map((x) => ({
            userId: x.user!.id,
            code: x.response.error?.code ?? null,
            message: x.response.error?.message ?? null,
          }))
      );
      if (logParams && res.successCount > 0) {
        for (let i = 0; i < res.responses.length; i++) {
          if (res.responses[i].success && fcmUsers[i]) {
            await logNotification({
              tenantId,
              recipientUserId: fcmUsers[i].id,
              title,
              body,
              type: logParams.type,
              createdByType: logParams.createdByType,
              createdById: logParams.createdById,
              scheduledNotificationId: logParams.scheduledNotificationId ?? null,
              payload: logPayload,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[notification] sendToTenantCustomers FCM failed:', tenantId, err instanceof Error ? err.message : err);
      failed += fcmUsers.length;
    }
  }

  if (expoUsers.length > 0) {
    try {
      const ex = await expoPushSend.sendExpoPushToUsers(
        expoUsers.map((u) => ({ id: u.id, token: u.fcm_token })),
        title,
        body,
        strData,
        imageUrl ?? null
      );
      sent += ex.sent;
      failed += ex.failed;
      if (ex.invalidUserIds.length > 0) await clearTokensForUsers(tenantId, ex.invalidUserIds);
      if (logParams && ex.successUserIds.length > 0) {
        for (const uid of ex.successUserIds) {
          await logNotification({
            tenantId,
            recipientUserId: uid,
            title,
            body,
            type: logParams.type,
            createdByType: logParams.createdByType,
            createdById: logParams.createdById,
            scheduledNotificationId: logParams.scheduledNotificationId ?? null,
            payload: logPayload,
          });
        }
      }
    } catch (err) {
      console.warn('[notification] sendToTenantCustomers Expo failed:', tenantId, err instanceof Error ? err.message : err);
      failed += expoUsers.length;
    }
  }

  await notificationSecurityAudit.logNotificationSecurityEvent({
    tenantId,
    actorUserId: auditContext?.actorUserId,
    actorEmail: auditContext?.actorEmail,
    actorRole: auditContext?.actorRole || 'retailer_admin',
    eventType: 'notification_send_tenant',
    outcome: failed > 0 ? 'failure' : 'success',
    requestId: auditContext?.requestId ?? null,
    ip: auditContext?.ip ?? null,
    userAgent: auditContext?.userAgent ?? null,
    details: {
      sent,
      failed,
      expoRecipients: expoUsers.length,
      fcmRecipients: fcmUsers.length,
    },
  });

  return { sent, failed };
}

export async function sendToSpecificUsers(
  userIds: string[],
  tenantId: string,
  title: string,
  body: string,
  opts?: SendNotificationOptions | Record<string, string>,
  logParams?: NotificationLogParams
): Promise<{ sent: number; failed: number }> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };
  const existingUsers = await db('users')
    .select('id')
    .where({ tenant_id: tenantId })
    .whereIn('id', userIds)
    .whereNull('deleted_at');
  if (existingUsers.length !== userIds.length) {
    throw new Error('TENANT_POLICY_VIOLATION: Some target users are outside tenant scope or deleted');
  }
  const users = await db('users')
    .select('id', 'fcm_token')
    .where({ tenant_id: tenantId })
    .whereIn('id', userIds)
    .whereNull('deleted_at')
    .whereNotNull('fcm_token');
  const valid = users.filter((u: { fcm_token: string | null }) => u.fcm_token && typeof u.fcm_token === 'string');
  if (valid.length === 0) return { sent: 0, failed: 0 };

  const expoUsers = valid.filter((u: { fcm_token: string }) => expoPushSend.isExpoPushToken(u.fcm_token));
  const fcmUsers = valid.filter((u: { fcm_token: string }) => !expoPushSend.isExpoPushToken(u.fcm_token));

  const { data: finalData, imageUrl } = normalizeNotificationOptions(opts);
  const strData = finalData ? stringifyData(finalData) : undefined;
  const logPayload =
    logParams?.payload ?? (finalData ? stringifyData(finalData) : null);

  let sent = 0;
  let failed = 0;

  if (fcmUsers.length > 0) {
    const notification: Record<string, string> = { title, body };
    if (imageUrl?.trim()) (notification as any).imageUrl = imageUrl.trim();
    const apnsConfig: import('firebase-admin/messaging').ApnsConfig = {
      payload: { aps: { sound: 'default', ...(imageUrl ? { 'mutable-content': 1 } : {}) } },
    };
    if (imageUrl?.trim()) (apnsConfig as any).fcmOptions = { imageUrl: imageUrl.trim() };
    const messaging = getFirebaseMessaging();
    const message: import('firebase-admin/messaging').MulticastMessage = {
      tokens: fcmUsers.map((u: { fcm_token: string }) => u.fcm_token),
      notification,
      data: strData,
      android: { priority: 'high' as const },
      apns: apnsConfig,
    };
    try {
      const res = await messaging.sendEachForMulticast(message);
      sent += res.successCount;
      failed += res.failureCount;
      await markInvalidTokens(
        tenantId,
        res.responses
          .map((r, i) => ({ response: r, user: fcmUsers[i] as { id: string } | undefined }))
          .filter((x) => !x.response.success && x.user)
          .map((x) => ({
            userId: x.user!.id,
            code: x.response.error?.code ?? null,
            message: x.response.error?.message ?? null,
          }))
      );
      if (logParams && res.successCount > 0) {
        for (let i = 0; i < res.responses.length; i++) {
          if (res.responses[i].success && fcmUsers[i]) {
            await logNotification({
              tenantId,
              recipientUserId: (fcmUsers[i] as { id: string }).id,
              title,
              body,
              type: logParams.type,
              createdByType: logParams.createdByType,
              createdById: logParams.createdById,
              scheduledNotificationId: logParams.scheduledNotificationId ?? null,
              payload: logPayload,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[notification] sendToSpecificUsers FCM failed:', tenantId, err instanceof Error ? err.message : err);
      failed += fcmUsers.length;
    }
  }

  if (expoUsers.length > 0) {
    try {
      const ex = await expoPushSend.sendExpoPushToUsers(
        expoUsers.map((u: { id: string; fcm_token: string }) => ({ id: u.id, token: u.fcm_token })),
        title,
        body,
        strData,
        imageUrl ?? null
      );
      sent += ex.sent;
      failed += ex.failed;
      if (ex.invalidUserIds.length > 0) await clearTokensForUsers(tenantId, ex.invalidUserIds);
      if (logParams && ex.successUserIds.length > 0) {
        for (const uid of ex.successUserIds) {
          await logNotification({
            tenantId,
            recipientUserId: uid,
            title,
            body,
            type: logParams.type,
            createdByType: logParams.createdByType,
            createdById: logParams.createdById,
            scheduledNotificationId: logParams.scheduledNotificationId ?? null,
            payload: logPayload,
          });
        }
      }
    } catch (err) {
      console.warn('[notification] sendToSpecificUsers Expo failed:', tenantId, err instanceof Error ? err.message : err);
      failed += expoUsers.length;
    }
  }

  return { sent, failed };
}

export async function sendToAllCustomers(
  tenantIds: string[] | undefined,
  title: string,
  body: string,
  opts?: SendNotificationOptions | Record<string, string>,
  prefKey: PrefKey = 'promotional',
  logParams?: NotificationLogParams
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

  const expoRows = valid.filter((r) => expoPushSend.isExpoPushToken(r.fcm_token));
  const fcmRows = valid.filter((r) => !expoPushSend.isExpoPushToken(r.fcm_token));

  const { data: finalData, imageUrl } = normalizeNotificationOptions(opts);
  const strData = finalData ? stringifyData(finalData) : undefined;
  const logPayload = finalData ? stringifyData(finalData) : null;

  let sent = 0;
  let failed = 0;

  if (fcmRows.length > 0) {
    const messaging = getFirebaseMessaging();
    const notification: Record<string, string> = { title, body };
    if (imageUrl?.trim()) (notification as Record<string, unknown>).imageUrl = imageUrl.trim();
    const apnsConfig: import('firebase-admin/messaging').ApnsConfig = {
      payload: { aps: { sound: 'default', ...(imageUrl ? { 'mutable-content': 1 } : {}) } },
    };
    if (imageUrl?.trim()) (apnsConfig as Record<string, unknown>).fcmOptions = { imageUrl: imageUrl.trim() };
    const message: import('firebase-admin/messaging').MulticastMessage = {
      tokens: fcmRows.map((r) => r.fcm_token),
      notification,
      data: strData,
      android: { priority: 'high' as const },
      apns: apnsConfig,
    };
    try {
      const res = await messaging.sendEachForMulticast(message);
      sent += res.successCount;
      failed += res.failureCount;
      const invalidByTenant = new Map<string, string[]>();
      for (let i = 0; i < res.responses.length; i++) {
        const r = res.responses[i];
        const target = fcmRows[i];
        if (!target || r.success || !isPermanentTokenFailure(r.error?.code ?? null)) continue;
        const arr = invalidByTenant.get(target.tenant_id) || [];
        arr.push(target.id);
        invalidByTenant.set(target.tenant_id, arr);
      }
      for (const [rowTenantId, userIds] of invalidByTenant.entries()) {
        await clearTokensForUsers(rowTenantId, userIds);
      }
      if (logParams && res.successCount > 0) {
        for (let i = 0; i < res.responses.length; i++) {
          if (res.responses[i].success && fcmRows[i]) {
            await logNotification({
              tenantId: fcmRows[i].tenant_id,
              recipientUserId: fcmRows[i].id,
              title,
              body,
              type: logParams.type,
              createdByType: logParams.createdByType,
              createdById: logParams.createdById,
              scheduledNotificationId: logParams.scheduledNotificationId ?? null,
              payload: logPayload,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[notification] sendToAllCustomers FCM failed:', err instanceof Error ? err.message : err);
      failed += fcmRows.length;
    }
  }

  if (expoRows.length > 0) {
    try {
      const ex = await expoPushSend.sendExpoPushToUsers(
        expoRows.map((r) => ({ id: r.id, token: r.fcm_token })),
        title,
        body,
        strData,
        imageUrl ?? null
      );
      sent += ex.sent;
      failed += ex.failed;
      const invalidSet = new Set(ex.invalidUserIds);
      const invalidByTenant = new Map<string, string[]>();
      for (const r of expoRows) {
        if (!invalidSet.has(r.id)) continue;
        const arr = invalidByTenant.get(r.tenant_id) || [];
        arr.push(r.id);
        invalidByTenant.set(r.tenant_id, arr);
      }
      for (const [tid, ids] of invalidByTenant.entries()) {
        await clearTokensForUsers(tid, ids);
      }
      if (logParams && ex.successUserIds.length > 0) {
        const idToTenant = new Map(expoRows.map((r) => [r.id, r.tenant_id]));
        for (const uid of ex.successUserIds) {
          const tid = idToTenant.get(uid);
          if (!tid) continue;
          await logNotification({
            tenantId: tid,
            recipientUserId: uid,
            title,
            body,
            type: logParams.type,
            createdByType: logParams.createdByType,
            createdById: logParams.createdById,
            scheduledNotificationId: logParams.scheduledNotificationId ?? null,
            payload: logPayload,
          });
        }
      }
    } catch (err) {
      console.warn('[notification] sendToAllCustomers Expo failed:', err instanceof Error ? err.message : err);
      failed += expoRows.length;
    }
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
