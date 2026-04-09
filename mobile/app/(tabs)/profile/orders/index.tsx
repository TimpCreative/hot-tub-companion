import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  TextInput,
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
  claimMyOrderByEmailAndConfirmation,
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
  const [claiming, setClaiming] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimEmail, setClaimEmail] = useState('');
  const [claimConfirmation, setClaimConfirmation] = useState('');

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

  const onManualClaim = useCallback(async () => {
    const orderEmail = claimEmail.trim().toLowerCase();
    const confirmationNumber = claimConfirmation.trim();
    if (!orderEmail || !confirmationNumber) {
      Alert.alert('Missing fields', 'Enter both the order email and confirmation number.');
      return;
    }
    setClaiming(true);
    try {
      const claimed = await claimMyOrderByEmailAndConfirmation(orderEmail, confirmationNumber);
      setClaimConfirmation('');
      setClaimModalOpen(false);
      Alert.alert('Order loaded', 'We found your order and added it to your history.');
      await load(1, false);
      if (claimed.orderReferenceId) {
        router.push(`/(tabs)/profile/orders/${claimed.orderReferenceId}`);
      }
    } catch (e) {
      Alert.alert('Could not load order', getApiErrorMessage(e));
    } finally {
      setClaiming(false);
    }
  }, [claimEmail, claimConfirmation, load, router]);

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
    <View style={{ paddingBottom: 12, gap: 10 }}>
      <Pressable
        onPress={() => void onSyncFromStore()}
        disabled={syncing || loading}
        style={({ pressed }) => ({
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed || syncing ? 0.75 : 1,
        })}
      >
        {syncing ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>Sync from store</Text>
        )}
      </Pressable>
      <Pressable
        onPress={() => setClaimModalOpen(true)}
        disabled={loading}
        style={({ pressed }) => ({
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border ?? '#e5e7eb',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>Load specific order</Text>
      </Pressable>
      <Modal visible={claimModalOpen} transparent animationType="fade" onRequestClose={() => setClaimModalOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={{ borderRadius: 14, padding: 14, backgroundColor: colors.contentBackground }}>
            <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]}>Load a specific order</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
              Enter the order email and confirmation or order number from your checkout email.
            </Text>
            <TextInput
              value={claimEmail}
              onChangeText={setClaimEmail}
              placeholder="Order email"
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                marginTop: 10,
                borderWidth: 1,
                borderColor: colors.border ?? '#e5e7eb',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
                backgroundColor: colors.surface,
              }}
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              value={claimConfirmation}
              onChangeText={setClaimConfirmation}
              placeholder="Confirmation or Order number"
              autoCapitalize="characters"
              style={{
                marginTop: 8,
                borderWidth: 1,
                borderColor: colors.border ?? '#e5e7eb',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
                backgroundColor: colors.surface,
              }}
              placeholderTextColor={colors.textMuted}
            />
            <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setClaimModalOpen(false)}
                disabled={claiming}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border ?? '#e5e7eb',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onManualClaim()}
                disabled={claiming || syncing || loading}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  alignItems: 'center',
                  opacity: pressed || claiming ? 0.75 : 1,
                })}
              >
                {claiming ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Load order</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {orders.length === 0 ? (
        <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', lineHeight: 18 }]}>
          New checkouts usually appear in about a minute.
        </Text>
      ) : null}
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
                No orders yet.
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}
