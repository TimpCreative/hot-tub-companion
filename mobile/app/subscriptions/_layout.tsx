import { Stack } from 'expo-router';

export default function SubscriptionsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: 'Subscription',
        headerBackTitle: 'Back',
      }}
    />
  );
}
