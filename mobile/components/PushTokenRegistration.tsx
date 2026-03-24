/**
 * Registers FCM token when user is authenticated as a customer.
 * Re-registers on app foreground (token can rotate).
 */

import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
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

export function PushTokenRegistration() {
  const { user } = useAuth();

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

  return null;
}
