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
    const rawToken = res?.data && typeof res.data === 'string' ? res.data.trim() : '';
    const tokenProvider = typeof res?.type === 'string' ? res.type : 'unknown';
    // FCM-native pipeline expects FCM registration tokens (typically include ':').
    // APNs tokens on iOS are intentionally not registered into fcm_token.
    const looksLikeFcm = rawToken.length > 100 && rawToken.includes(':');
    const token = looksLikeFcm ? rawToken : null;
    const tokenStatus = looksLikeFcm ? 'ready' : 'unsupported';
    const tokenError = looksLikeFcm
      ? null
      : `Unsupported token format/provider (${tokenProvider}). Expected FCM registration token.`;
    const timezone = getDeviceTimezone();
    if (!looksLikeFcm) {
      console.warn('[registerPushToken] Device token is not FCM-compatible; token not registered.');
    }

    await api.put('/users/me/fcm-token', {
      fcmToken: token ?? null,
      tokenProvider,
      tokenStatus,
      tokenError,
      ...(timezone && { timezone }),
    });
  } catch (err) {
    console.warn('[registerPushToken] Failed:', err instanceof Error ? err.message : err);
  }
}

