import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { openStripeHostedUrl } from '../../../lib/stripeHostedBrowser';
import { subscriptionStatusExplanation } from '../../../lib/subscriptionStatusHints';
import { useTheme } from '../../../theme/ThemeProvider';
import { useAuth } from '../../../contexts/AuthContext';
import {
  listMySubscriptions,
  postSubscriptionBillingPortal,
  type CustomerSubscriptionRow,
} from '../../../services/subscriptions';
import { messageFromApiReject } from '../../../services/cart';

function isStaffTenantAppLogin(user: { id: string } | null): boolean {
  return Boolean(user?.id?.startsWith('admin_'));
}

export default function ProfileSubscriptionsScreen() {
  const router = useRouter();
  const { colors, typography } = useTheme();
  const { user } = useAuth();
  const [rows, setRows] = useState<CustomerSubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const staff = isStaffTenantAppLogin(user);

  const load = useCallback(async () => {
    if (staff) {
      setLoading(false);
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await listMySubscriptions();
      setRows(Array.isArray(res?.data?.subscriptions) ? res.data!.subscriptions : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [staff]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await postSubscriptionBillingPortal();
      const url = res?.data?.url;
      if (url) await openStripeHostedUrl(url);
      else Alert.alert('Billing', 'Portal link not available.');
    } catch (e) {
      Alert.alert('Billing', messageFromApiReject(e, 'Could not open billing portal.'));
    } finally {
      setPortalLoading(false);
    }
  };

  if (staff) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', padding: 24 }]}>
          Subscriptions are not available for retailer staff accounts.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[typography.body, { color: colors.textSecondary, marginBottom: 16 }]}>
        Manage your subscription billing and payment method in Stripe&apos;s secure portal.
      </Text>
      <Pressable
        style={[styles.portalBtn, { backgroundColor: colors.primary, opacity: portalLoading ? 0.7 : 1 }]}
        onPress={() => void openPortal()}
        disabled={portalLoading || rows.length === 0}
      >
        <Text style={styles.portalBtnText}>{portalLoading ? 'Opening…' : 'Payment & billing'}</Text>
      </Pressable>
      {rows.length === 0 ? (
        <Text style={[typography.body, { color: colors.textMuted, marginTop: 24 }]}>No active subscriptions yet.</Text>
      ) : (
        rows.map((r) => {
          const hint = subscriptionStatusExplanation(r.status);
          return (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/(tabs)/profile/subscriptions/${r.id}`)}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.contentBackground }]}
            >
              <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]}>
                {r.bundle_title || 'Subscription'}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>Status: {r.status}</Text>
              {hint ? (
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8, lineHeight: 18 }]}>
                  {hint}
                </Text>
              ) : null}
              {r.current_period_end ? (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: hint ? 6 : 0 }]}>
                  Current period ends: {new Date(r.current_period_end).toLocaleDateString()}
                </Text>
              ) : null}
              {r.cancel_at_period_end ? (
                <Text style={[typography.caption, { color: '#b45309', marginTop: 4 }]}>Ends after this period</Text>
              ) : null}
              <Text style={[typography.caption, { color: colors.primary, marginTop: 10, fontWeight: '600' }]}>
                Details →
              </Text>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  portalBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  portalBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: { marginTop: 16, borderWidth: 1, borderRadius: 12, padding: 14 },
});
