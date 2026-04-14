import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPageHeader } from '../../components/AppPageHeader';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { getApiErrorMessage } from '../../lib/apiError';
import { navigateFromNotificationPayload } from '../../lib/notificationDeepLink';
import { useTheme } from '../../theme/ThemeProvider';

type InboxNotification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  category: string;
  sentAt: string;
  readAt: string | null;
  payload: Record<string, unknown> | null;
};

type NotificationsEnvelope = {
  success?: boolean;
  data?: {
    notifications?: InboxNotification[];
    nextCursor?: string | null;
  };
};

function isStaffTenantAppLogin(user: { id: string } | null): boolean {
  return Boolean(user?.id?.startsWith('admin_'));
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function categoryLabel(category: string): string {
  switch (category) {
    case 'maintenance':
      return 'Care';
    case 'order':
      return 'Order';
    case 'retailer':
      return 'Retailer';
    case 'promotional':
      return 'Promo';
    case 'system':
      return 'System';
    default:
      return '';
  }
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const { colors, typography } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;

  const [segment, setSegment] = useState<'notifications' | 'messages'>('notifications');
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor: string | null | undefined, append: boolean) => {
      if (!userId || userId.startsWith('admin_')) {
        setItems([]);
        setNextCursor(null);
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      setError(null);
      if (append) setLoadingMore(true);
      try {
        const qs = new URLSearchParams();
        qs.set('limit', '25');
        if (cursor) qs.set('cursor', cursor);
        const raw = (await api.get(`/users/me/notifications?${qs.toString()}`)) as NotificationsEnvelope;
        const body = raw?.data;
        const list = body?.notifications ?? [];
        setNextCursor(body?.nextCursor ?? null);
        if (append) setItems((prev) => [...prev, ...list]);
        else setItems(list);
      } catch (e: unknown) {
        setError(getApiErrorMessage(e));
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    setLoading(true);
    void load(undefined, false);
  }, [userId, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(undefined, false);
  }, [load]);

  const onEndReached = useCallback(() => {
    if (nextCursor && !loading && !refreshing && !loadingMore) {
      void load(nextCursor, true);
    }
  }, [load, nextCursor, loading, refreshing, loadingMore]);

  const onPressRow = useCallback(
    async (n: InboxNotification) => {
      if (!user || isStaffTenantAppLogin(user)) return;
      try {
        await api.patch(`/users/me/notifications/${n.id}/read`, {});
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
        );
        navigateFromNotificationPayload(router, n.payload);
      } catch {
        navigateFromNotificationPayload(router, n.payload);
      }
    },
    [router, user]
  );

  const customerBlocked = !userId || !user || isStaffTenantAppLogin(user);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        data={segment === 'notifications' ? items : []}
        keyExtractor={(item) => item.id}
        refreshControl={
          segment === 'notifications' ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          ) : undefined
        }
        onEndReached={segment === 'notifications' ? onEndReached : undefined}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <>
            <AppPageHeader title="Inbox" subtitle="Messages and updates from your retailer." />
            <View style={styles.segment}>
              <Pressable
                onPress={() => setSegment('notifications')}
                style={[
                  styles.segmentBtn,
                  {
                    backgroundColor: segment === 'notifications' ? colors.surface : 'transparent',
                    borderColor: colors.border ?? '#e5e7eb',
                  },
                ]}
              >
                <Text
                  style={[
                    typography.body,
                    { fontWeight: '600', color: segment === 'notifications' ? colors.text : colors.textSecondary },
                  ]}
                >
                  Notifications
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSegment('messages')}
                style={[
                  styles.segmentBtn,
                  {
                    backgroundColor: segment === 'messages' ? colors.surface : 'transparent',
                    borderColor: colors.border ?? '#e5e7eb',
                  },
                ]}
              >
                <Text
                  style={[
                    typography.body,
                    { fontWeight: '600', color: segment === 'messages' ? colors.text : colors.textSecondary },
                  ]}
                >
                  Messages
                </Text>
              </Pressable>
            </View>
            {segment === 'messages' ? (
              <Text style={[styles.body, { color: colors.textSecondary, marginBottom: 16 }]}>
                Two-way chat with your retailer is coming in a future update.
              </Text>
            ) : null}
            {segment === 'notifications' && customerBlocked ? (
              <Text style={[styles.body, { color: colors.textSecondary, marginBottom: 16 }]}>
                Sign in with a customer account to see notifications.
              </Text>
            ) : null}
            {segment === 'notifications' && !customerBlocked && loading && items.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            ) : null}
            {segment === 'notifications' && error ? (
              <Text style={[styles.body, { color: colors.textSecondary, marginBottom: 12 }]}>{error}</Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          segment === 'notifications' && !customerBlocked && !loading && !error ? (
            <Text style={[styles.body, { color: colors.textSecondary }]}>No notifications yet.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const unread = !item.readAt;
          const label = categoryLabel(item.category);
          return (
            <Pressable
              onPress={() => void onPressRow(item)}
              style={[
                styles.row,
                {
                  borderColor: colors.border ?? '#e5e7eb',
                  backgroundColor: colors.surface,
                  opacity: unread ? 1 : 0.92,
                },
              ]}
            >
              <View style={styles.rowTop}>
                {label ? (
                  <View style={[styles.badge, { backgroundColor: colors.primary + '22' }]}>
                    <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                      {label}
                    </Text>
                  </View>
                ) : null}
                <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 'auto' }]}>
                  {formatWhen(item.sentAt)}
                </Text>
              </View>
              <Text style={[typography.body, { color: colors.text, fontWeight: '700', marginTop: 6 }]}>
                {item.title}
              </Text>
              {item.body ? (
                <Text
                  style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}
                  numberOfLines={3}
                >
                  {item.body}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 24 },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  row: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
