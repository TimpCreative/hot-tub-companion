import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { formatOrderMoney } from '../../services/orders';
import { useTheme } from '../../theme/ThemeProvider';

export type RecentOrderItem = {
  id: string;
  shopifyOrderId: string;
  shopifyOrderNumber: number | null;
  createdAt: string;
  orderedAt?: string | null;
  currency?: string | null;
  totalCents?: number | null;
};

type OrdersApiEnvelope = {
  success?: boolean;
  data?: {
    orders: RecentOrderItem[];
    pagination?: { total?: number };
  };
};

function formatOrderLabel(o: RecentOrderItem): string {
  if (o.shopifyOrderNumber != null) return `Order #${o.shopifyOrderNumber}`;
  return `Order ${o.shopifyOrderId}`;
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function rowDate(o: RecentOrderItem): string {
  const iso = o.orderedAt || o.createdAt;
  return formatWhen(iso);
}

export function RecentOrdersCard() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const [orders, setOrders] = useState<RecentOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const raw = (await api.get('/orders?pageSize=5')) as OrdersApiEnvelope;
      if (raw?.success && raw.data?.orders) {
        setOrders(raw.data.orders);
      } else {
        setOrders([]);
      }
    } catch {
      setError(true);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading && orders.length === 0) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            marginBottom: spacing.lg,
            borderColor: colors.border ?? '#e5e7eb',
          },
        ]}
      >
        <Text style={[typography.h3, { color: colors.text, marginBottom: 8 }]}>Recent orders</Text>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || orders.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          marginBottom: spacing.lg,
          borderColor: colors.border ?? '#e5e7eb',
        },
      ]}
    >
      <Text style={[typography.h3, { color: colors.text, marginBottom: 4 }]}>Recent orders</Text>
      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 12 }]}>
        Confirmed after checkout; may take a moment to appear.
      </Text>
      {orders.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => router.push(`/(tabs)/profile/orders/${o.id}`)}
          style={[styles.row, { borderBottomColor: colors.border ?? '#f1f5f9' }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
              {formatOrderLabel(o)}
            </Text>
            {rowDate(o) ? (
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {rowDate(o)}
              </Text>
            ) : null}
          </View>
          {o.totalCents != null ? (
            <Text style={[typography.body, { color: colors.text, fontWeight: '700', marginLeft: 12 }]}>
              {formatOrderMoney(o.totalCents, o.currency ?? null)}
            </Text>
          ) : null}
        </Pressable>
      ))}
      <Pressable onPress={() => void load()} style={{ marginTop: 10 }}>
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Refresh</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/(tabs)/profile/orders')} style={{ marginTop: 8 }}>
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>View all orders</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
