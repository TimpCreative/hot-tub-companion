import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchMyOrderById,
  formatOrderMoney,
  orderTitle,
  type OrderDetail,
} from '../../../../services/orders';
import { useTheme } from '../../../../theme/ThemeProvider';

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors, typography } = useTheme();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setError('Invalid order.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const row = await fetchMyOrderById(id);
      setOrder(row);
      if (!row) setError('Order not found.');
    } catch {
      setError('Could not load this order.');
      setOrder(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      void load();
    }, [user, load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center' }}>
        <Text style={[typography.body, { color: colors.text, textAlign: 'center' }]}>Sign in to view orders.</Text>
      </View>
    );
  }

  if (loading && !order) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={[typography.body, { color: colors.text }]}>{error || 'Order not found.'}</Text>
        {!order?.hasSnapshot ? (
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 12, lineHeight: 20 }]}>
            Details can take a moment to sync after checkout. Pull to refresh.
          </Text>
        ) : null}
      </ScrollView>
    );
  }

  const snap = order.snapshot;
  const cur = snap?.currency ?? order.currency ?? 'USD';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={[typography.h3, { color: colors.text }]}>{orderTitle(order)}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
        {formatWhen(order.orderedAt || order.createdAt)}
      </Text>
      {order.financialStatus ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4, textTransform: 'capitalize' }]}>
          Status: {order.financialStatus.replace(/_/g, ' ')}
        </Text>
      ) : null}
      {order.customerEmail ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>{order.customerEmail}</Text>
      ) : null}

      {!snap ? (
        <View
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border ?? '#e5e7eb',
            backgroundColor: colors.surface,
          }}
        >
          <Text style={[typography.body, { color: colors.text }]}>
            Order details are still syncing. Pull down to refresh, or check back in a moment.
          </Text>
          <Text style={[typography.body, { color: colors.text, fontWeight: '700', marginTop: 12 }]}>
            Total: {formatOrderMoney(order.totalCents, order.currency)}
          </Text>
        </View>
      ) : (
        <>
          <Text style={[typography.h3, { color: colors.text, marginTop: 24, marginBottom: 12 }]}>Items</Text>
          {snap.lineItems.map((line, idx) => (
            <View
              key={`${line.title}-${idx}`}
              style={{
                flexDirection: 'row',
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border ?? '#f1f5f9',
              }}
            >
              {line.imageUrl ? (
                <Image source={{ uri: line.imageUrl }} style={{ width: 56, height: 56, borderRadius: 8 }} />
              ) : (
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 8,
                    backgroundColor: colors.border ?? '#e5e7eb',
                  }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>{line.title}</Text>
                {line.variantTitle ? (
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>{line.variantTitle}</Text>
                ) : null}
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>
                  Qty {line.quantity} · {formatOrderMoney(line.unitPriceCents, cur)} each
                </Text>
              </View>
              <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]}>
                {formatOrderMoney(line.lineTotalCents, cur)}
              </Text>
            </View>
          ))}

          <View style={{ marginTop: 20, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>Subtotal</Text>
              <Text style={[typography.body, { color: colors.text }]}>{formatOrderMoney(snap.subtotalCents, cur)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>Shipping</Text>
              <Text style={[typography.body, { color: colors.text }]}>{formatOrderMoney(snap.shippingCents, cur)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>Tax</Text>
              <Text style={[typography.body, { color: colors.text }]}>{formatOrderMoney(snap.taxCents, cur)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]}>Total</Text>
              <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]}>
                {formatOrderMoney(snap.totalCents, cur)}
              </Text>
            </View>
          </View>

          {snap.shippingSummary ? (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 16, lineHeight: 20 }]}>
              Ship to: {snap.shippingSummary}
            </Text>
          ) : null}
          {snap.confirmationNumber ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>
              Confirmation: {snap.confirmationNumber}
            </Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
