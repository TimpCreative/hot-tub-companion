import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { TenantProvider } from '../contexts/TenantContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../theme/ThemeProvider';
import { HeaderProfileButton } from '../components/HeaderProfileButton';
import { PushTokenRegistration } from '../components/PushTokenRegistration';

SplashScreen.preventAutoHideAsync();

const PRIMARY = '#1B4D7A';

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
            <Stack.Screen
              name="water-test"
              options={{
                headerShown: true,
                title: 'Water Test',
                headerBackTitle: 'Back',
                headerRight: () => <HeaderProfileButton />,
                headerStyle: { backgroundColor: PRIMARY },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="maintenance-log"
              options={{
                headerShown: true,
                title: 'Maintenance Log',
                headerBackTitle: 'Back',
                headerRight: () => <HeaderProfileButton />,
                headerStyle: { backgroundColor: PRIMARY },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="water-guides"
              options={{
                headerShown: true,
                title: 'Guides & Videos',
                headerBackTitle: 'Back',
                headerRight: () => <HeaderProfileButton />,
                headerStyle: { backgroundColor: PRIMARY },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="services"
              options={{
                headerShown: true,
                title: 'Services',
                headerBackTitle: 'Back',
                headerRight: () => <HeaderProfileButton />,
                headerStyle: { backgroundColor: PRIMARY },
                headerTintColor: '#fff',
              }}
            />
          </Stack>
        </AuthProvider>
      </ThemeProvider>
    </TenantProvider>
  );
}
