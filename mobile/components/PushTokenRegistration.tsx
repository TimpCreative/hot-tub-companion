/**
 * Registers FCM token when user is authenticated as a customer.
 * Re-registers on app foreground (token can rotate).
 * Handles notification tap → deep link navigation.
 */

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { registerPushToken } from '../lib/registerPushToken';

function isStaffTenantAppLogin(user: { id: string } | null): boolean {
  return Boolean(user?.id?.startsWith('admin_'));
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function handleNotificationTap(data: Record<string, string> | null, router: ReturnType<typeof useRouter>) {
  if (!data?.linkType || !router) return;
  const linkType = String(data.linkType);
  const linkId = data.linkId ? String(data.linkId) : '';

  switch (linkType) {
    case 'shop':
      router.push('/(tabs)/shop');
      break;
    case 'product':
      router.push(linkId ? `/(tabs)/shop?productId=${encodeURIComponent(linkId)}` : '/(tabs)/shop');
      break;
    case 'inbox':
      router.push('/(tabs)/inbox');
      break;
    case 'dealer':
      router.push('/(tabs)/dealer');
      break;
    case 'services':
      router.push('/services');
      break;
    case 'home':
      router.push('/(tabs)/home');
      break;
    case 'custom_url':
      if (linkId && /^https?:\/\//i.test(linkId)) {
        Linking.openURL(linkId);
      }
      break;
    default:
      break;
  }
}

export function PushTokenRegistration() {
  const { user } = useAuth();
  const router = useRouter();

  const shouldRegister = user && !isStaffTenantAppLogin(user);

  useEffect(() => {
    if (!shouldRegister) return;
    void registerPushToken();
  }, [shouldRegister]);

  useEffect(() => {
    if (!shouldRegister) return;
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void registerPushToken();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [shouldRegister]);

  useEffect(() => {
    if (!shouldRegister) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data) {
        handleNotificationTap(data, router);
      }
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response?.notification.request.content.data) return;
      const data = response.notification.request.content.data as Record<string, string>;
      handleNotificationTap(data, router);
    });

    return () => sub.remove();
  }, [router, shouldRegister]);

  return null;
}
