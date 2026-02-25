import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { TenantProvider } from '../contexts/TenantContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <TenantProvider>
      <AuthProvider>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="auth/register" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </TenantProvider>
  );
}
