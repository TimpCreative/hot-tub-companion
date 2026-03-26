/**
 * Registers the device's FCM/push token with the API.
 * Also sends device timezone for user-local notification scheduling.
 * Call when user is authenticated (customer account, not staff override).
 */

import * as Notifications from 'expo-notifications';
import api from '../services/api';

function getDeviceTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz.length > 0 && tz.length <= 64 ? tz : null;
  } catch {
    return null;
  }
}

async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function registerPushToken(): Promise<void> {
  try {
    const granted = await requestPermissions();
    if (!granted) return;

    const res = await Notifications.getDevicePushTokenAsync();
    const token = res?.data && typeof res.data === 'string' ? res.data : null;
    const timezone = getDeviceTimezone();
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a47da7ba-8944-40d5-a7b1-3ca8dd181a2c', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '8c62d1',
      },
      body: JSON.stringify({
        sessionId: '8c62d1',
        runId: 'pre-fix',
        hypothesisId: 'H1-H2',
        location: 'mobile/lib/registerPushToken.ts:31',
        message: 'Device push token acquired',
        data: {
          tokenSource: 'getDevicePushTokenAsync',
          tokenLength: token?.length ?? 0,
          tokenPrefix: token ? token.slice(0, 12) : null,
          timezone,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    await api.put('/users/me/fcm-token', {
      fcmToken: token ?? null,
      ...(timezone && { timezone }),
    });
  } catch (err) {
    console.warn('[registerPushToken] Failed:', err instanceof Error ? err.message : err);
  }
}

