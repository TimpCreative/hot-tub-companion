import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';
import api from '../../../services/api';
import { getApiErrorMessage } from '../../../lib/apiError';
import { useTheme } from '../../../theme/ThemeProvider';

function isStaffTenantAppLogin(user: { id: string } | null): boolean {
  return Boolean(user?.id?.startsWith('admin_'));
}

export default function ProfilePrivacyScreen() {
  const { user } = useAuth();
  const { config } = useTenant();
  const { colors } = useTheme();

  const [shareWaterTests, setShareWaterTests] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const staffAppLogin = isStaffTenantAppLogin(user);
  const tenantName = config?.name ?? 'Your retailer';

  const load = useCallback(async () => {
    if (staffAppLogin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = (await api.get('/users/me')) as { data?: { shareWaterTestsWithRetailer?: boolean } };
      setShareWaterTests(!!res?.data?.shareWaterTestsWithRetailer);
    } catch {
      setShareWaterTests(false);
    } finally {
      setLoading(false);
    }
  }, [staffAppLogin]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (saving || staffAppLogin) return;
    setSaving(true);
    try {
      await api.put('/users/me', { shareWaterTestsWithRetailer: shareWaterTests });
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !staffAppLogin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>Loading…</Text>
      </View>
    );
  }

  if (staffAppLogin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.staffNote, { color: colors.textMuted }]}>Staff login: privacy settings are not available.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>
            Share water test data with {tenantName}
          </Text>
          <Switch
            value={shareWaterTests}
            onValueChange={setShareWaterTests}
            trackColor={{ false: '#ccc', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          When enabled, {tenantName} can view your water test results to help with recommendations and support.
        </Text>
        <Button title="Save" onPress={handleSave} loading={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { padding: 16, borderRadius: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  toggleLabel: { fontSize: 16, flex: 1 },
  hint: { fontSize: 13, marginTop: 8, lineHeight: 19 },
  staffNote: { fontSize: 14 },
});
