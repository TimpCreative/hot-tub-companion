import { Stack } from 'expo-router';
import { useTenant } from '../../../contexts/TenantContext';
import { buildAppStackHeaderOptions, buildReplacementBackButton } from '../../../lib/appHeader';

export default function ProfileLayout() {
  const { config } = useTenant();
  const primary = config?.branding?.primaryColor ?? '#1B4D7A';

  return (
    <Stack
      screenOptions={{
        ...buildAppStackHeaderOptions(primary),
        headerBackTitle: 'Profile',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Profile' }} />
      <Stack.Screen name="account" options={{ title: 'Profile Information' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notification Preferences' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="more" options={{ title: 'Account Actions' }} />
      <Stack.Screen name="spa/edit/[id]" options={{ title: 'Edit Spa' }} />
      <Stack.Screen
        name="subscriptions"
        options={{
          title: 'Subscriptions',
          headerLeft: buildReplacementBackButton('/(tabs)/profile'),
        }}
      />
      <Stack.Screen
        name="subscriptions/[id]"
        options={{
          title: 'Subscription',
          headerLeft: buildReplacementBackButton('/(tabs)/profile/subscriptions'),
        }}
      />
      <Stack.Screen name="orders/index" options={{ title: 'Orders' }} />
      <Stack.Screen name="orders/[id]" options={{ title: 'Order details' }} />
      <Stack.Screen name="orders/thanks" options={{ title: 'Thank you' }} />
    </Stack>
  );
}
