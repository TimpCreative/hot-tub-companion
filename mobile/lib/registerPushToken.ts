/**
 * Registers the device's FCM/push token with the API.
 * Call when user is authenticated (customer account, not staff override).
 */

import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus } from 'react-native';
import api from '../services/api';

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

    await api.put('/users/me/fcm-token', { fcmToken: token ?? null });
  } catch (err) {
    console.warn('[registerPushToken] Failed:', err instanceof Error ? err.message : err);
  }
}

