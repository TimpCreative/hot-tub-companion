import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  Switch,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';
import api from '../../../services/api';
import { clearSetupSkippedFlag } from '../../../lib/setupSkippedStorage';
import { getApiErrorMessage } from '../../../lib/apiError';
import { useTheme } from '../../../theme/ThemeProvider';

type Profile = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  notificationPrefMaintenance?: boolean;
  notificationPrefOrders?: boolean;
  notificationPrefSubscriptions?: boolean;
  notificationPrefService?: boolean;
  notificationPrefPromotional?: boolean;
  shareWaterTestsWithRetailer?: boolean;
};

type SpaProfile = {
  id: string;
  brand?: string | null;
  modelLine?: string | null;
  model?: string | null;
  year?: number | null;
  nickname?: string | null;
  serialNumber?: string | null;
};

function isStaffTenantAppLogin(user: { id: string } | null): boolean {
  return Boolean(user?.id?.startsWith('admin_'));
}

function spaDisplayName(spa: SpaProfile): string {
  if (spa.nickname?.trim()) return spa.nickname.trim();
  const parts = [spa.brand, spa.modelLine || spa.model, spa.year].filter(Boolean);
  return parts.join(' ') || 'Spa';
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const { config } = useTenant();
  const { colors } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [spaProfiles, setSpaProfiles] = useState<SpaProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [changeEmailVisible, setChangeEmailVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changeEmailSending, setChangeEmailSending] = useState(false);

  const staffAppLogin = isStaffTenantAppLogin(user);
  const tenantName = config?.name ?? 'Your retailer';

  const load = useCallback(async () => {
    if (staffAppLogin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [profileRes, spaRes] = await Promise.all([
        api.get('/users/me') as Promise<{ data?: Profile }>,
        api.get('/spa-profiles') as Promise<{ data?: { spaProfiles?: SpaProfile[] } }>,
      ]);
      setProfile(profileRes?.data ?? (profileRes as unknown as Profile));
      setSpaProfiles(spaRes?.data?.spaProfiles ?? []);
    } catch {
      setProfile(null);
      setSpaProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [staffAppLogin]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveProfile = async () => {
    if (!profile || saving || staffAppLogin) return;
    setSaving(true);
    try {
      const res = (await api.put('/users/me', {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        zipCode: profile.zipCode,
        country: profile.country,
        notificationPrefMaintenance: profile.notificationPrefMaintenance,
        notificationPrefOrders: profile.notificationPrefOrders,
        notificationPrefSubscriptions: profile.notificationPrefSubscriptions,
        notificationPrefService: profile.notificationPrefService,
        notificationPrefPromotional: profile.notificationPrefPromotional,
        shareWaterTestsWithRetailer: profile.shareWaterTestsWithRetailer,
      })) as { data?: Profile };
      setProfile(res?.data ?? profile);
      await refreshUser();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return;
    setChangeEmailSending(true);
    try {
      const { getFirebaseAuth } = await import('../../../lib/firebase');
      const { verifyBeforeUpdateEmail } = await import('@firebase/auth');
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'You must be signed in to change your email.');
        return;
      }
      await verifyBeforeUpdateEmail(currentUser, newEmail.trim());
      setChangeEmailVisible(false);
      setNewEmail('');
      Alert.alert(
        'Check your email',
        'We sent a verification link to your new email. Click it to complete the change. Your email will update when you return to the app.'
      );
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed to send verification email';
      Alert.alert('Error', msg);
    } finally {
      setChangeEmailSending(false);
    }
  };

  const handleDeleteSpa = (spa: SpaProfile) => {
    Alert.alert(
      'Delete spa',
      `Remove ${spaDisplayName(spa)} from your account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/spa-profiles/${spa.id}`);
              setSpaProfiles((prev) => prev.filter((p) => p.id !== spa.id));
            } catch (err) {
              Alert.alert('Error', getApiErrorMessage(err));
            }
          },
        },
      ]
    );
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
      if (__DEV__) console.warn('[Reset onboarding]', err);
      setResetError(getApiErrorMessage(err));
    } finally {
      setResetting(false);
    }
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const termsUrl = config?.termsUrl;
  const privacyUrl = config?.privacyUrl;

  if (loading && !staffAppLogin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      {staffAppLogin ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Staff login</Text>
          <Text style={[styles.staffNote, { color: colors.textMuted }]}>
            Your email is allowed in this app as a retailer admin, not as an end-customer account.
          </Text>
        </View>
      ) : (
        <>
          {/* Account */}
          <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
            {profile && (
              <>
                <View style={styles.row}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Email</Text>
                  <View style={styles.emailRow}>
                    <Text style={[styles.value, { color: colors.text }]}>{profile.email}</Text>
                    <TouchableOpacity onPress={() => setChangeEmailVisible(true)}>
                      <Text style={[styles.link, { color: colors.primary }]}>Change</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.row}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>First name</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={profile.firstName ?? ''}
                    onChangeText={(t) => setProfile({ ...profile, firstName: t })}
                    placeholder="First name"
                  />
                </View>
                <View style={styles.row}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Last name</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={profile.lastName ?? ''}
                    onChangeText={(t) => setProfile({ ...profile, lastName: t })}
                    placeholder="Last name"
                  />
                </View>
                <View style={styles.row}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Phone</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={profile.phone ?? ''}
                    onChangeText={(t) => setProfile({ ...profile, phone: t })}
                    placeholder="Phone"
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.row}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Address</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    value={profile.addressLine1 ?? ''}
                    onChangeText={(t) => setProfile({ ...profile, addressLine1: t })}
                    placeholder="Address line 1"
                  />
                  <TextInput
                    style={[styles.input, styles.inputMargin, { color: colors.text, borderColor: colors.border }]}
                    value={profile.addressLine2 ?? ''}
                    onChangeText={(t) => setProfile({ ...profile, addressLine2: t })}
                    placeholder="Address line 2"
                  />
                  <View style={styles.row2}>
                    <TextInput
                      style={[styles.input, styles.inputSmall, { color: colors.text, borderColor: colors.border }]}
                      value={profile.city ?? ''}
                      onChangeText={(t) => setProfile({ ...profile, city: t })}
                      placeholder="City"
                    />
                    <TextInput
                      style={[styles.input, styles.inputSmall, { color: colors.text, borderColor: colors.border }]}
                      value={profile.state ?? ''}
                      onChangeText={(t) => setProfile({ ...profile, state: t })}
                      placeholder="State"
                    />
                    <TextInput
                      style={[styles.input, styles.inputSmall, { color: colors.text, borderColor: colors.border }]}
                      value={profile.zipCode ?? ''}
                      onChangeText={(t) => setProfile({ ...profile, zipCode: t })}
                      placeholder="ZIP"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <Button title="Save changes" onPress={handleSaveProfile} loading={saving} />
              </>
            )}
          </View>

          {/* My Spas */}
          <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>My Spas</Text>
            {spaProfiles.map((spa) => (
              <View key={spa.id} style={[styles.spaRow, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.spaMain}
                  onPress={() => router.push(`/(tabs)/profile/spa/edit/${spa.id}`)}
                >
                  <Text style={[styles.spaName, { color: colors.text }]}>{spaDisplayName(spa)}</Text>
                  <Text style={[styles.spaSub, { color: colors.textMuted }]}>
                    {[spa.brand, spa.model, spa.year].filter(Boolean).join(' · ')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push(`/(tabs)/profile/spa/edit/${spa.id}`)}>
                  <Text style={[styles.link, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSpa(spa)}>
                  <Text style={[styles.link, styles.danger, { color: '#dc2626' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
            <Button
              title="Add Another Spa"
              variant="outline"
              onPress={() => router.push('/onboarding?returnTo=profile')}
            />
          </View>

          {/* Notification Preferences */}
          {profile && (
            <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Notification preferences</Text>
              {[
                { key: 'notificationPrefMaintenance', label: 'Maintenance reminders' },
                { key: 'notificationPrefOrders', label: 'Order updates' },
                { key: 'notificationPrefSubscriptions', label: 'Subscription reminders' },
                { key: 'notificationPrefService', label: 'Service appointments' },
                { key: 'notificationPrefPromotional', label: 'Promotional' },
              ].map(({ key, label }) => (
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
              <Button title="Save preferences" onPress={handleSaveProfile} loading={saving} />
            </View>
          )}

          {/* Privacy */}
          {profile && (
            <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy</Text>
              <View style={styles.toggleRow}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                  Share water test data with {tenantName}
                </Text>
                <Switch
                  value={!!profile.shareWaterTestsWithRetailer}
                  onValueChange={(v) => setProfile({ ...profile, shareWaterTestsWithRetailer: v })}
                  trackColor={{ false: '#ccc', true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
              <Button title="Save" onPress={handleSaveProfile} loading={saving} />
            </View>
          )}

          {/* App Info */}
          <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>App info</Text>
            <Text style={[styles.infoRow, { color: colors.textMuted }]}>Version {appVersion}</Text>
            {termsUrl ? (
              <TouchableOpacity onPress={() => Linking.openURL(termsUrl)}>
                <Text style={[styles.link, { color: colors.primary }]}>Terms of Service</Text>
              </TouchableOpacity>
            ) : null}
            {privacyUrl ? (
              <TouchableOpacity onPress={() => Linking.openURL(privacyUrl)}>
                <Text style={[styles.link, { color: colors.primary }]}>Privacy Policy</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Reset onboarding (dev) */}
          <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
            <Button
              title={resetting ? 'Resetting…' : 'Reset onboarding'}
              variant="outline"
              onPress={handleResetOnboarding}
              loading={resetting}
              disabled={staffAppLogin}
            />
            {resetError ? <Text style={styles.error}>{resetError}</Text> : null}
          </View>
        </>
      )}

      {/* Sign Out */}
      <View style={styles.section}>
        <Button title="Sign Out" onPress={handleLogout} />
      </View>

      {/* Delete Account */}
      {!staffAppLogin && (
        <View style={styles.section}>
          <Button
            title="Delete account"
            variant="outline"
            onPress={() => setDeleteConfirmVisible(true)}
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Permanently remove your account and data.
          </Text>
        </View>
      )}

      {/* Delete confirmation modal */}
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

      {/* Change email modal */}
      <Modal visible={changeEmailVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Change email</Text>
            <TextInput
              style={[styles.input, styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="New email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button title="Send verification email" onPress={handleChangeEmail} loading={changeEmailSending} />
            <Button title="Cancel" variant="outline" onPress={() => { setChangeEmailVisible(false); setNewEmail(''); }} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  row: { marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 8 },
  label: { fontSize: 13, marginBottom: 4 },
  value: { fontSize: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  inputMargin: { marginTop: 8 },
  inputSmall: { flex: 1 },
  emailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontSize: 14 },
  danger: { color: '#dc2626' },
  spaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  spaMain: { flex: 1 },
  spaName: { fontSize: 16, fontWeight: '500' },
  spaSub: { fontSize: 13 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleLabel: { fontSize: 16 },
  infoRow: { fontSize: 14, marginBottom: 8 },
  hint: { fontSize: 13, marginTop: 8 },
  error: { color: '#dc2626', fontSize: 14, marginTop: 8 },
  staffNote: { fontSize: 13, lineHeight: 19 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 12,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  modalText: { fontSize: 14, marginBottom: 12 },
  modalInput: { marginBottom: 8 },
});
