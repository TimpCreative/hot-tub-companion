/**
 * Sends notifications via Expo Push API (ExponentPushToken[...]).
 * Used for iOS and any client that registers Expo tokens; FCM tokens use firebase-admin.
 */

import Expo, { type ExpoPushMessage } from 'expo-server-sdk';
import { env } from '../config/environment';

let expoClient: Expo | null = null;

function getExpo(): Expo {
  if (!expoClient) {
    expoClient = new Expo({
      accessToken: env.EXPO_ACCESS_TOKEN || undefined,
    });
  }
  return expoClient;
}

export function isExpoPushToken(token: string): boolean {
  return Expo.isExpoPushToken(token);
}

export type ExpoPushUser = { id: string; token: string };

export async function sendExpoPushToUsers(
  users: ExpoPushUser[],
  title: string,
  body: string,
  data?: Record<string, string>,
  imageUrl?: string | null
): Promise<{ sent: number; failed: number; invalidUserIds: string[]; successUserIds: string[] }> {
  if (users.length === 0) return { sent: 0, failed: 0, invalidUserIds: [], successUserIds: [] };

  const expo = getExpo();
  const payloadData: Record<string, string> = { ...(data || {}) };
  if (imageUrl?.trim()) payloadData.imageUrl = imageUrl.trim();

  const messages: ExpoPushMessage[] = users.map((u) => ({
    to: u.token,
    sound: 'default',
    title,
    body,
    priority: 'high',
    ...(Object.keys(payloadData).length > 0 ? { data: payloadData } : {}),
    ...(imageUrl?.trim() ? { mutableContent: true } : {}),
  }));

  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  let failed = 0;
  const invalidUserIds: string[] = [];
  const successUserIds: string[] = [];
  let idx = 0;

  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    for (let i = 0; i < tickets.length; i++) {
      const user = users[idx++];
      const t = tickets[i];
      if (!user) continue;
      if (t.status === 'ok') {
        sent++;
        successUserIds.push(user.id);
      } else {
        failed++;
        const code = t.details?.error;
        if (code === 'DeviceNotRegistered') invalidUserIds.push(user.id);
      }
    }
  }

  return { sent, failed, invalidUserIds, successUserIds };
}
