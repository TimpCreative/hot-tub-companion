import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { View, Text, StyleSheet } from 'react-native';

export default function Index() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: tenantLoading, error: tenantError } = useTenant();

  useEffect(() => {
    if (!tenantLoading && !authLoading) {
      SplashScreen.hideAsync();
      if (tenantError) {
        return;
      }
      if (!user) {
        router.replace('/auth/login');
      } else {
        router.replace('/(tabs)/home');
      }
    }
  }, [tenantLoading, authLoading, user, tenantError]);

  if (tenantError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{tenantError}</Text>
      </View>
    );
  }

  return <LoadingSpinner />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  error: {
    color: '#dc2626',
    textAlign: 'center',
  },
});
