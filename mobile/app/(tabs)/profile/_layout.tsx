import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
      <Stack.Screen name="spa/edit/[id]" options={{ title: 'Edit Spa' }} />
    </Stack>
  );
}
