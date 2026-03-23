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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
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
};

function isStaffTenantAppLogin(user: { id: string } | null): boolean {
  return Boolean(user?.id?.startsWith('admin_'));
}

export default function ProfileAccountScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changeEmailVisible, setChangeEmailVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changeEmailSending, setChangeEmailSending] = useState(false);

  const staffAppLogin = isStaffTenantAppLogin(user);

  const load = useCallback(async () => {
    if (staffAppLogin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = (await api.get('/users/me')) as { data?: Profile };
      setProfile(res?.data ?? (res as unknown as Profile));
    } catch {
      setProfile(null);
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
        <Text style={[styles.staffNote, { color: colors.textMuted }]}>Staff login: profile editing is not available.</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>Could not load profile.</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
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
              placeholder="Street address"
            />
            <TextInput
              style={[styles.input, styles.inputMargin, { color: colors.text, borderColor: colors.border }]}
              value={profile.addressLine2 ?? ''}
              onChangeText={(t) => setProfile({ ...profile, addressLine2: t })}
              placeholder="Apt, suite, etc. (optional)"
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
          <Button title="Save changes" onPress={handleSave} loading={saving} />
        </View>

        <Modal visible={changeEmailVisible} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
          </TouchableWithoutFeedback>
        </Modal>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { padding: 16, borderRadius: 12 },
  row: { marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 8 },
  label: { fontSize: 13, marginBottom: 4 },
  value: { fontSize: 16 },
  emailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  inputMargin: { marginTop: 8 },
  inputSmall: { flex: 1 },
  staffNote: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { borderRadius: 12, padding: 24, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  modalInput: { marginBottom: 8 },
});
