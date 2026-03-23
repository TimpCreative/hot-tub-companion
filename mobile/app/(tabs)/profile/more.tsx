import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { clearSetupSkippedFlag } from '../../../lib/setupSkippedStorage';
import { getApiErrorMessage } from '../../../lib/apiError';
import { useTheme } from '../../../theme/ThemeProvider';

function isStaffTenantAppLogin(user: { id: string } | null): boolean {
  return Boolean(user?.id?.startsWith('admin_'));
}

export default function ProfileMoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors } = useTheme();

  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const staffAppLogin = isStaffTenantAppLogin(user);

  const handleResetOnboarding = async () => {
    setResetError(null);
    setResetting(true);
    try {
      await api.delete('/spa-profiles');
      await clearSetupSkippedFlag();
      router.replace('/onboarding');
    } catch (err: unknown) {
      if (__DEV__) console.warn('[Reset onboarding]', err);
      setResetError(getApiErrorMessage(err));
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteAccount = (hardDelete: boolean) => {
    setDeleteConfirmVisible(false);
    (async () => {
      try {
        await api.delete('/users/me', { data: { hardDelete } });
        await logout();
        router.replace('/auth/login');
      } catch (err) {
        Alert.alert('Error', getApiErrorMessage(err));
      }
    })();
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Reset onboarding</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Removes your spa profile for this retailer and opens setup again (for testing).
        </Text>
        <Button
          title={resetting ? 'Resetting…' : 'Reset onboarding'}
          variant="outline"
          onPress={handleResetOnboarding}
          loading={resetting}
          disabled={staffAppLogin}
        />
        {resetError ? <Text style={styles.error}>{resetError}</Text> : null}
      </View>

      {!staffAppLogin && (
        <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Delete account</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Permanently remove your account and data.
          </Text>
          <Button
            title="Delete account"
            variant="outline"
            onPress={() => setDeleteConfirmVisible(true)}
          />
        </View>
      )}

      <Modal visible={deleteConfirmVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete account</Text>
            <Text style={[styles.modalText, { color: colors.textMuted }]}>
              Choose how to delete your account:
            </Text>
            <Button
              title="Soft delete (recoverable with support)"
              variant="outline"
              onPress={() => handleDeleteAccount(false)}
            />
            <Button
              title="Permanently delete (cannot be undone)"
              variant="outline"
              onPress={() => {
                Alert.alert(
                  'Confirm permanent delete',
                  'This will remove your account, spas, and all data. You cannot recover this.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Permanently delete', style: 'destructive', onPress: () => handleDeleteAccount(true) },
                  ]
                );
              }}
            />
            <Button title="Cancel" variant="outline" onPress={() => setDeleteConfirmVisible(false)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  section: { marginBottom: 24, padding: 16, borderRadius: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  hint: { fontSize: 13, marginBottom: 12, lineHeight: 19 },
  error: { color: '#dc2626', fontSize: 14, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { borderRadius: 12, padding: 24, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  modalText: { fontSize: 14, marginBottom: 12 },
});
