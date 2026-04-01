import { Stack } from 'expo-router';
import { useTenant } from '../../../contexts/TenantContext';
import { buildAppStackHeaderOptions } from '../../../lib/appHeader';

export default function ProfileLayout() {
  const { config } = useTenant();
  const primary = config?.branding?.primaryColor ?? '#1B4D7A';

  return (
    <Stack
      screenOptions={{
        ...buildAppStackHeaderOptions(primary),
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="account" options={{ title: 'Profile Information' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notification Preferences' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="more" options={{ title: 'Account Actions' }} />
      <Stack.Screen name="spa/edit/[id]" options={{ title: 'Edit Spa' }} />
    </Stack>
  );
}
