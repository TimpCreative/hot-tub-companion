import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeroHeader } from '../../components/AppHeroHeader';
import { StatusBarBar } from '../../components/StatusBarBar';
import { useActiveSpa } from '../../contexts/ActiveSpaContext';
import * as maintenanceApi from '../../services/maintenance';
import type { MaintenanceActivityItem } from '../../services/maintenance';
import { useTheme } from '../../theme/ThemeProvider';

function utcDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayHeading(dayKey: string): string {
  if (dayKey === 'unknown') return 'Unknown date';
  const [y, mo, d] = dayKey.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function strPayload(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function activityTitle(item: MaintenanceActivityItem): string {
  const p = item.payload;
  const t = strPayload(p?.title);
  if (t) return t;
  switch (item.action) {
    case 'superseded':
      return 'Schedule cleanup';
    default:
      return 'Care task';
  }
}

function activityDetail(item: MaintenanceActivityItem): string {
  const p = item.payload;
  switch (item.action) {
    case 'completed':
      return strPayload(p?.completedAt)
        ? `Completed at ${formatTime(String(p.completedAt))}`
        : 'Marked done';
    case 'snoozed': {
      const preset = strPayload(p?.preset);
      const until = strPayload(p?.snoozedUntil);
      if (until) {
        try {
          const u = new Date(until);
          if (!Number.isNaN(u.getTime())) {
            return `Hidden until ${u.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
          }
        } catch {
          /* ignore */
        }
      }
      if (preset === '1h') return 'Snoozed 1 hour';
      if (preset === '1d') return 'Snoozed 1 day';
      if (preset === '7d') return 'Snoozed 7 days';
      return 'Snoozed';
    }
    case 'rescheduled': {
      const to = strPayload(p?.toDueDate);
      const from = strPayload(p?.fromDueDate);
      if (to && from) return `Moved from ${from} → ${to}`;
      if (to) return `New due date ${to}`;
      return 'Rescheduled';
    }
    case 'deleted':
      return strPayload(p?.dueDate) ? `Was due ${p.dueDate}` : 'Removed from schedule';
    case 'superseded': {
      const removed = strPayload(p?.removedDueDate);
      const kept = strPayload(p?.keptDueDate);
      if (removed && kept) return `Kept newer due ${kept}; removed ${removed}`;
      if (removed) return `Removed older due ${removed}`;
      return 'Duplicate task merged';
    }
    case 'created':
      return strPayload(p?.dueDate) ? `Due ${p.dueDate}` : 'Added';
    default:
      return '';
  }
}

function actionLabel(action: string): string {
  switch (action) {
    case 'completed':
      return 'Done';
    case 'snoozed':
      return 'Snooze';
    case 'rescheduled':
      return 'Move';
    case 'deleted':
      return 'Remove';
    case 'superseded':
      return 'Merge';
    case 'created':
      return 'New';
    default:
      return action;
  }
}

function actionAccent(action: string): { bg: string; fg: string } {
  switch (action) {
    case 'completed':
      return { bg: '#1a7f4a22', fg: '#1a7f4a' };
    case 'snoozed':
      return { bg: '#b4530922', fg: '#b45309' };
    case 'rescheduled':
      return { bg: '#1d4ed822', fg: '#1d4ed8' };
    case 'deleted':
      return { bg: '#b91c1c22', fg: '#b91c1c' };
    case 'superseded':
      return { bg: '#6b21a822', fg: '#6b21a8' };
    case 'created':
      return { bg: '#0f766e22', fg: '#0f766e' };
    default:
      return { bg: '#64748b22', fg: '#64748b' };
  }
}

export default function MaintenanceHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ spaProfileId?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { spaProfileId: ctxSpaId } = useActiveSpa();
  const spaProfileId = (typeof params.spaProfileId === 'string' && params.spaProfileId) || ctxSpaId || '';
  const primaryHex = colors.primary ?? '#1B4D7A';
  const scrollY = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MaintenanceActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!spaProfileId) {
        setItems([]);
        setLoading(false);
        return;
      }
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await maintenanceApi.listMaintenanceActivity(spaProfileId, { page: nextPage, pageSize: 40 });
        setTotalPages(res.totalPages);
        setPage(res.page);
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
      } catch {
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [spaProfileId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadPage(1, false);
    }, [loadPage])
  );

  const grouped = useMemo(() => {
    const map = new Map<string, MaintenanceActivityItem[]>();
    for (const it of items) {
      const key = utcDayKey(it.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    const days = [...map.keys()].sort((a, b) => b.localeCompare(a));
    return days.map((day) => ({ day, rows: map.get(day) ?? [] }));
  }, [items]);

  const goBack = useCallback(() => {
    router.replace('/(tabs)/maintenance-timeline' as Href);
  }, [router]);

  const canLoadMore = page < totalPages;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBarBar primaryColor={primaryHex} scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <AppHeroHeader
          onBackPress={goBack}
          icon="time-outline"
          title="Task history"
          subtitle="Snoozes, reschedules, completions, and more"
        />

        {!spaProfileId ? (
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No spa selected</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Open Care Schedule and pick a spa, then return here.
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={goBack}>
              <Text style={styles.primaryBtnText}>Back to Care Schedule</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <Text style={[styles.emptyBody, { color: colors.textSecondary, marginTop: 8 }]}>No activity yet.</Text>
        ) : (
          <>
            {grouped.map((g) => (
              <View key={g.day} style={styles.dayBlock}>
                <Text style={[styles.dayHeading, { color: colors.textSecondary }]}>{formatDayHeading(g.day)}</Text>
                {g.rows.map((row) => {
                  const acc = actionAccent(row.action);
                  const detail = activityDetail(row);
                  return (
                    <View
                      key={row.id}
                      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.contentBackground }]}
                    >
                      <View style={styles.cardTop}>
                        <View style={[styles.badge, { backgroundColor: acc.bg }]}>
                          <Text style={[styles.badgeText, { color: acc.fg }]}>{actionLabel(row.action)}</Text>
                        </View>
                        <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(row.createdAt)}</Text>
                      </View>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>{activityTitle(row)}</Text>
                      {detail ? (
                        <Text style={[styles.cardDetail, { color: colors.textSecondary }]}>{detail}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
            {canLoadMore ? (
              <TouchableOpacity
                style={[styles.moreBtn, { borderColor: colors.border }]}
                disabled={loadingMore}
                onPress={() => void loadPage(page + 1, true)}
              >
                {loadingMore ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Load more</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 24 },
  dayBlock: { marginBottom: 8 },
  dayHeading: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  time: { fontSize: 13 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardDetail: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  empty: { borderRadius: 16, borderWidth: 1, padding: 20, marginTop: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyBody: { fontSize: 15, lineHeight: 22 },
  primaryBtn: { marginTop: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  moreBtn: {
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
});
