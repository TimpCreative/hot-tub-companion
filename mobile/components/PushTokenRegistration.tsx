/**
 * Registers FCM token when user is authenticated as a customer.
 * Re-registers on app foreground (token can rotate).
 * Handles notification tap → deep link navigation.
 */

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { navigateFromNotificationPayload } from '../lib/notificationDeepLink';
import { registerPushToken } from '../lib/registerPushToken';

function isStaffTenantAppLogin(user: { id: string } | null): boolean {
  return Boolean(user?.id?.startsWith('admin_'));
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function handleNotificationTap(data: Record<string, string> | null, router: ReturnType<typeof useRouter>) {
  if (!data) return;
  navigateFromNotificationPayload(router, data as Record<string, unknown>);
}

export function PushTokenRegistration() {
  const { user } = useAuth();
  const router = useRouter();

  const shouldRegister = user && !isStaffTenantAppLogin(user);

  useEffect(() => {
    if (__DEV__ && user && isStaffTenantAppLogin(user)) {
      console.warn(
        '[PushTokenRegistration] Push tokens are only registered for customer accounts. ' +
          'Tenant-admin / whitelist logins use a synthetic id and cannot register a device token. ' +
          'Sign in with a normal customer account on this tenant to test retailer pushes.'
      );
    }
    if (!shouldRegister) return;
    void registerPushToken();
  }, [shouldRegister, user]);

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
