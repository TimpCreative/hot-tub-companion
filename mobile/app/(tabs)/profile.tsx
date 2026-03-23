import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { clearSetupSkippedFlag } from '../../lib/setupSkippedStorage';
import { getApiErrorMessage } from '../../lib/apiError';

function isStaffTenantAppLogin(user: { id: string } | null): boolean {
  return Boolean(user?.id?.startsWith('admin_'));
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const staffAppLogin = isStaffTenantAppLogin(user);

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
      {user && (
        <View style={styles.info}>
          <Text>
            {user.firstName} {user.lastName}
          </Text>
          <Text>{user.email}</Text>
          {staffAppLogin ? (
            <Text style={styles.staffNote}>
              Staff login: your email is allowed in this app as a retailer admin, not as an end-customer
              account. Hot tub profiles and "reset onboarding" only apply to users registered as customers
              for this retailer.
            </Text>
          ) : null}
        </View>
      )}
      <View style={styles.actions}>
        <Button
          title={resetting ? 'Resetting…' : 'Reset onboarding'}
          onPress={handleResetOnboarding}
          variant="outline"
          disabled={resetting || staffAppLogin}
        />
        {resetting && <ActivityIndicator style={styles.spinner} />}
        {resetError ? <Text style={styles.error}>{resetError}</Text> : null}
        <Text style={styles.hint}>
          {staffAppLogin
            ? 'Use Register or a separate test customer email (not on the retailer admin allowlist) to try onboarding and reset.'
            : 'Removes your spa profile for this retailer and opens setup again (for testing). Requires the API to support DELETE /spa-profiles (deploy latest API or point the app at your dev server).'}
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
  staffNote: {
    marginTop: 12,
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
});
