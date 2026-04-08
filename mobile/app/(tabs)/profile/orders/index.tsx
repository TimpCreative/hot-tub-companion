import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchMyOrders,
  formatOrderMoney,
  orderTitle,
  syncMyOrdersFromShopify,
  type OrderListItem,
} from '../../../../services/orders';
import { getApiErrorMessage } from '../../../../lib/apiError';
import { useTheme } from '../../../../theme/ThemeProvider';

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function OrdersListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, typography } = useTheme();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async (p: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const { orders: next, pagination } = await fetchMyOrders(p, 20);
      setTotalPages(Math.max(1, pagination.totalPages || 1));
      setPage(p);
      setOrders((prev) => (append ? [...prev, ...next] : next));
    } catch {
      setError('Could not load orders.');
      if (!append) setOrders([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setLoading(false);
        return;
      }
      void load(1, false);
    }, [user, load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(1, false);
  }, [load]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || page >= totalPages) return;
    void load(page + 1, true);
  }, [load, loadingMore, loading, page, totalPages]);

  const onSyncFromStore = useCallback(async () => {
    setSyncing(true);
    try {
      const r = await syncMyOrdersFromShopify();
      const found = r.fetchedFromShopify > 0 || r.claimedRows > 0 || r.upserted > 0;
      Alert.alert(
        found ? 'Orders synced' : 'No orders found',
        found
          ? `Updated from your store (${r.upserted} order(s), ${r.snapshotsWritten} with full details).`
          : 'No orders matched your account email in Shopify. Use the same email as your store checkout.',
      );
      await load(1, false);
    } catch (e) {
      Alert.alert('Could not sync', getApiErrorMessage(e));
    } finally {
      setSyncing(false);
    }
  }, [load]);

  const renderItem = useCallback(
    ({ item }: { item: OrderListItem }) => {
      const when = formatWhen(item.orderedAt || item.createdAt);
      return (
        <Pressable
          onPress={() => router.push(`/(tabs)/profile/orders/${item.id}`)}
          style={({ pressed }) => [
            {
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.border ?? '#f1f5f9',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]}>{orderTitle(item)}</Text>
              {when ? (
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>{when}</Text>
              ) : null}
              {item.firstLineTitle ? (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]} numberOfLines={2}>
                  {item.lineItemCount > 1 ? `${item.firstLineTitle} · +${item.lineItemCount - 1} more` : item.firstLineTitle}
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]}>
                {formatOrderMoney(item.totalCents, item.currency)}
              </Text>
              {item.financialStatus ? (
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, textTransform: 'capitalize' }]}>
                  {item.financialStatus.replace(/_/g, ' ')}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, router, typography]
  );

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center' }}>
        <Text style={[typography.body, { color: colors.text, textAlign: 'center' }]}>Sign in to see your orders.</Text>
        <Pressable onPress={() => router.push('/auth/login')} style={{ marginTop: 16, alignSelf: 'center' }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  const listHeader = (
    <View style={{ paddingBottom: 8 }}>
      <Text style={[typography.caption, { color: colors.textSecondary, lineHeight: 18, marginBottom: 10 }]}>
        Missing older orders? We match your app email to Shopify. Sync pulls past orders from the store.
      </Text>
      <Pressable
        onPress={() => void onSyncFromStore()}
        disabled={syncing || loading}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.primary,
          opacity: pressed || syncing ? 0.75 : 1,
        })}
      >
        {syncing ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>Sync from store</Text>
        )}
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {error ? (
        <Text style={{ color: '#b91c1c', paddingHorizontal: 20, paddingTop: 12 }}>{error}</Text>
      ) : null}
      {loading && orders.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} /> : null}
          ListEmptyComponent={
            !loading ? (
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 24 }]}>
                No orders yet. Tap “Sync from store” to load past orders, or check out — new orders appear after the store
                confirms them.
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}
