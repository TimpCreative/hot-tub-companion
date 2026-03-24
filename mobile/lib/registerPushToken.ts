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

    await api.put('/users/me/fcm-token', {
      fcmToken: token ?? null,
      ...(timezone && { timezone }),
    });
  } catch (err) {
    console.warn('[registerPushToken] Failed:', err instanceof Error ? err.message : err);
  }
}

