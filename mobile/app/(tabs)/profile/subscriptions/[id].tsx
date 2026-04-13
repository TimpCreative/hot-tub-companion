import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { openStripeHostedUrl } from '../../../../lib/stripeHostedBrowser';
import { subscriptionStatusExplanation } from '../../../../lib/subscriptionStatusHints';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  listMySubscriptions,
  postSubscriptionBillingPortal,
  type CustomerSubscriptionRow,
} from '../../../../services/subscriptions';
import { messageFromApiReject } from '../../../../services/cart';

function isStaffTenantAppLogin(user: { id: string } | null): boolean {
  return Boolean(user?.id?.startsWith('admin_'));
}

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography } = useTheme();
  const { user } = useAuth();
  const [row, setRow] = useState<CustomerSubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const staff = isStaffTenantAppLogin(user);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (staff || !id) {
      setLoading(false);
      setRow(null);
      return;
    }
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    try {
      const res = await listMySubscriptions();
      const rows = Array.isArray(res?.data?.subscriptions) ? res.data!.subscriptions : [];
      setRow(rows.find((r) => r.id === id) ?? null);
    } catch {
      setRow(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [staff, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setRefreshing(false);
    }
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

  if (!row) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
          This subscription was not found. It may have been removed—go back to the list and pull to refresh.
        </Text>
      </View>
    );
  }

  const hint = subscriptionStatusExplanation(row.status);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />}
    >
      <Text style={[typography.body, { color: colors.text, fontWeight: '800', fontSize: 20 }]}>
        {row.bundle_title || 'Subscription'}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 10 }]}>Status: {row.status}</Text>
      {hint ? (
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12, lineHeight: 22 }]}>{hint}</Text>
      ) : null}
      {row.current_period_end ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 14 }]}>
          Current period ends: {new Date(row.current_period_end).toLocaleDateString()}
        </Text>
      ) : null}
      {row.cancel_at_period_end ? (
        <Text style={[typography.caption, { color: '#b45309', marginTop: 8 }]}>Scheduled to end after this period</Text>
      ) : null}
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 16 }]}>
        Reference id: {row.stripe_subscription_id?.slice(0, 18)}…
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8, lineHeight: 18 }]}>
        Plan changes and payment method updates are handled in Stripe&apos;s billing portal (opens in-app).
      </Text>
      <Pressable
        style={[styles.portalBtn, { backgroundColor: colors.primary, opacity: portalLoading ? 0.7 : 1, marginTop: 24 }]}
        onPress={() => void openPortal()}
        disabled={portalLoading}
      >
        <Text style={styles.portalBtnText}>{portalLoading ? 'Opening…' : 'Payment & billing'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  portalBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  portalBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
