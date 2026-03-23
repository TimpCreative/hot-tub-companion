import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { shiftHueSaturateHex } from '../../../lib/colorUtils';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';
import api from '../../../services/api';
import { getApiErrorMessage } from '../../../lib/apiError';
import { useTheme } from '../../../theme/ThemeProvider';
import { StatusBarBar } from '../../../components/StatusBarBar';

type Profile = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
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
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { config } = useTenant();
  const { colors } = useTheme();

  const primaryHex = colors.primary ?? '#1B4D7A';
  const gradientStart = shiftHueSaturateHex(primaryHex, 16, 1.25);
  const gradientColors = [gradientStart, primaryHex] as const;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [spaProfiles, setSpaProfiles] = useState<SpaProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

  const staffAppLogin = isStaffTenantAppLogin(user);

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

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const termsUrl = config?.termsUrl;
  const privacyUrl = config?.privacyUrl;

  if (loading && !staffAppLogin) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <StatusBarBar primaryColor={primaryHex} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBarBar primaryColor={primaryHex} scrollY={scrollY} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 48 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
        >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 20, marginHorizontal: -24, marginTop: -24 }]}
        >
          <View style={styles.heroTitleRow}>
            <Ionicons name="person-outline" size={28} color="#fff" />
            <Text style={styles.heroTitle}>Profile</Text>
          </View>
          <Text style={styles.heroSubtitle}>Manage your hot tub information</Text>
        </LinearGradient>
        {staffAppLogin ? (
          <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Staff login</Text>
            <Text style={[styles.staffNote, { color: colors.textMuted }]}>
              Your email is allowed in this app as a retailer admin, not as an end-customer account.
            </Text>
          </View>
        ) : (
          <>
            {/* Profile info button */}
            <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
              {profile && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryName, { color: colors.text }]}>
                    {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Account'}
                  </Text>
                  <Text style={[styles.summaryEmail, { color: colors.textMuted }]}>{profile.email}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.menuRow, { borderTopColor: colors.border }]}
                onPress={() => router.push('/(tabs)/profile/account')}
              >
                <Text style={[styles.menuLabel, { color: colors.text }]}>Profile information</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
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

            {/* Notification preferences button */}
            <TouchableOpacity
              style={[styles.section, styles.menuSection, { backgroundColor: colors.contentBackground }]}
              onPress={() => router.push('/(tabs)/profile/notifications')}
            >
              <Text style={[styles.menuLabel, { color: colors.text }]}>Notification preferences</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Privacy button */}
            <TouchableOpacity
              style={[styles.section, styles.menuSection, { backgroundColor: colors.contentBackground }]}
              onPress={() => router.push('/(tabs)/profile/privacy')}
            >
              <Text style={[styles.menuLabel, { color: colors.text }]}>Privacy</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

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

            {/* Account actions (Reset, Delete) */}
            <TouchableOpacity
              style={[styles.section, styles.menuSection, { backgroundColor: colors.contentBackground }]}
              onPress={() => router.push('/(tabs)/profile/more')}
            >
              <Text style={[styles.menuLabel, { color: colors.text }]}>Account actions</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </>
        )}

        {/* Sign Out - always at bottom */}
        <View style={styles.section}>
          <Button title="Sign Out" onPress={handleLogout} />
        </View>
      </Animated.ScrollView>
    </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    marginBottom: 20,
  },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTitle: { fontSize: 28, fontWeight: '700', color: '#fff' },
  heroSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  menuSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  summaryRow: { marginBottom: 12 },
  summaryName: { fontSize: 18, fontWeight: '600' },
  summaryEmail: { fontSize: 14 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  menuLabel: { fontSize: 16 },
  link: { fontSize: 14, marginTop: 8 },
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
  infoRow: { fontSize: 14, marginBottom: 8 },
  staffNote: { fontSize: 13, lineHeight: 19 },
});
