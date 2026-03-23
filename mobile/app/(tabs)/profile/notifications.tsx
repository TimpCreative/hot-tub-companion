import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { getApiErrorMessage } from '../../../lib/apiError';
import { useTheme } from '../../../theme/ThemeProvider';

type Profile = {
  notificationPrefMaintenance?: boolean;
  notificationPrefOrders?: boolean;
  notificationPrefSubscriptions?: boolean;
  notificationPrefService?: boolean;
  notificationPrefPromotional?: boolean;
};

function isStaffTenantAppLogin(user: { id: string } | null): boolean {
  return Boolean(user?.id?.startsWith('admin_'));
}

const PREFS = [
  { key: 'notificationPrefMaintenance', label: 'Maintenance reminders' },
  { key: 'notificationPrefOrders', label: 'Order updates' },
  { key: 'notificationPrefSubscriptions', label: 'Subscription reminders' },
  { key: 'notificationPrefService', label: 'Service appointments' },
  { key: 'notificationPrefPromotional', label: 'Promotional' },
] as const;

export default function ProfileNotificationsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const staffAppLogin = isStaffTenantAppLogin(user);

  const load = useCallback(async () => {
    if (staffAppLogin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = (await api.get('/users/me')) as { data?: Profile };
      setProfile(res?.data ?? (res as unknown as Profile) ?? {});
    } catch {
      setProfile({});
    } finally {
      setLoading(false);
    }
  }, [staffAppLogin]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!profile || saving || staffAppLogin) return;
    setSaving(true);
    try {
      await api.put('/users/me', {
        notificationPrefMaintenance: profile.notificationPrefMaintenance,
        notificationPrefOrders: profile.notificationPrefOrders,
        notificationPrefSubscriptions: profile.notificationPrefSubscriptions,
        notificationPrefService: profile.notificationPrefService,
        notificationPrefPromotional: profile.notificationPrefPromotional,
      });
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
        <Text style={[styles.staffNote, { color: colors.textMuted }]}>Staff login: notification preferences are not available.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
        {PREFS.map(({ key, label }) => (
          <View key={key} style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text>
            <Switch
              value={!!(profile as Record<string, unknown>)[key]}
              onValueChange={(v) => setProfile({ ...profile, [key]: v })}
              trackColor={{ false: '#ccc', true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        ))}
        <Button title="Save preferences" onPress={handleSave} loading={saving} />
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
  toggleLabel: { fontSize: 16 },
  staffNote: { fontSize: 14 },
});
