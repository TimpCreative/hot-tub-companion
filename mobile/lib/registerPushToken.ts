/**
 * Registers the device's push token with the API (Expo Push Token on all platforms).
 * Also sends device timezone for user-local notification scheduling.
 * Call when user is authenticated (customer account, not staff override).
 */

import Constants from 'expo-constants';
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

function resolveEasProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const fromExtra = extra?.eas?.projectId;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  const fromEas = Constants.easConfig?.projectId;
  if (typeof fromEas === 'string' && fromEas.length > 0) return fromEas;
  return null;
}

export async function registerPushToken(): Promise<void> {
  try {
    const granted = await requestPermissions();
    if (!granted) return;

    const projectId = resolveEasProjectId();
    if (!projectId) {
      console.warn('[registerPushToken] Missing EAS projectId; cannot obtain Expo push token.');
      return;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoToken =
      tokenRes?.data && typeof tokenRes.data === 'string' ? tokenRes.data.trim() : '';
    if (!expoToken) {
      console.warn('[registerPushToken] Empty Expo push token.');
      return;
    }

    const timezone = getDeviceTimezone();

    await api.put('/users/me/fcm-token', {
      fcmToken: expoToken,
      tokenProvider: 'expo',
      tokenStatus: 'ready',
      tokenError: null,
      ...(timezone && { timezone }),
    });
    if (__DEV__) {
      console.log('[registerPushToken] Expo token registered with API');
    }
  } catch (err) {
    console.warn('[registerPushToken] Failed:', err instanceof Error ? err.message : err);
  }
}
