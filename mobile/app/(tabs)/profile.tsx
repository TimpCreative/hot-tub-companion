import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { clearSetupSkippedFlag } from '../../lib/setupSkippedStorage';
import { getApiErrorMessage } from '../../lib/apiError';

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  const handleResetOnboarding = async () => {
    setResetError(null);
    setResetting(true);
    try {
      await api.delete('/spa-profiles');
      await clearSetupSkippedFlag();
      router.replace('/onboarding');
    } catch (err: unknown) {
      if (__DEV__) {
        console.warn('[Reset onboarding]', err);
      }
      setResetError(getApiErrorMessage(err));
    } finally {
      setResetting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {user && (
        <View style={styles.info}>
          <Text>{user.firstName} {user.lastName}</Text>
          <Text>{user.email}</Text>
        </View>
      )}
      <View style={styles.actions}>
        <Button
          title={resetting ? 'Resetting…' : 'Reset onboarding'}
          onPress={handleResetOnboarding}
          variant="outline"
          disabled={resetting}
        />
        {resetting && <ActivityIndicator style={styles.spinner} />}
        {resetError ? <Text style={styles.error}>{resetError}</Text> : null}
        <Text style={styles.hint}>
          Removes your spa profile for this retailer and opens setup again (for testing). Requires the API
          to support DELETE /spa-profiles (deploy latest API or point the app at your dev server).
        </Text>
        <Button title="Sign Out" onPress={handleLogout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  info: {
    marginBottom: 24,
  },
  actions: {
    gap: 12,
  },
  spinner: {
    marginVertical: 4,
  },
  hint: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
  },
});
