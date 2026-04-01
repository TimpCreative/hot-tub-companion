import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { TenantProvider } from '../contexts/TenantContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../theme/ThemeProvider';
import { PushTokenRegistration } from '../components/PushTokenRegistration';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <TenantProvider>
      <ThemeProvider>
        <AuthProvider>
          <PushTokenRegistration />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="auth/register" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
          </Stack>
        </AuthProvider>
      </ThemeProvider>
    </TenantProvider>
  );
}
