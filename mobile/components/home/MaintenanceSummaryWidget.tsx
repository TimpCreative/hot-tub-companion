import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useActiveSpa } from '../../contexts/ActiveSpaContext';
import * as maintenanceApi from '../../services/maintenance';
import type { MaintenanceEvent } from '../../services/maintenance';
import { useTheme } from '../../theme/ThemeProvider';

function utcTodayKey(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;
}

function sortForSummary(events: MaintenanceEvent[]): MaintenanceEvent[] {
  const today = utcTodayKey();
  const open = events.filter((e) => !e.completedAt);
  const overdue = open.filter((e) => e.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcoming = open.filter((e) => e.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return [...overdue, ...upcoming];
}

export function MaintenanceSummaryWidget({
  title = 'Care schedule',
  maxItems = 3,
}: {
  title?: string;
  maxItems?: number;
}) {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const { spaProfileId } = useActiveSpa();
  const primaryHex = colors.primary ?? '#1B4D7A';
  const cap = Math.min(8, Math.max(1, Math.floor(maxItems) || 3));

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);

  const load = useCallback(async () => {
    if (!spaProfileId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await maintenanceApi.listMaintenanceEvents(spaProfileId, { status: 'pending', pageSize: 80 });
      setEvents(sortForSummary(list).slice(0, cap));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [spaProfileId, cap]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!spaProfileId) {
    return null;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.contentBackground,
          borderColor: `${primaryHex}22`,
          marginBottom: spacing.md,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      onPress={() => router.push('/maintenance-timeline' as Href)}
    >
      <View style={styles.titleRow}>
        <Ionicons name="construct-outline" size={20} color={primaryHex} style={{ marginRight: 8 }} />
        <Text style={[typography.h3, { color: colors.text, fontSize: 17, flex: 1 }]}>{title}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 12 }} color={primaryHex} />
      ) : events.length === 0 ? (
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>
          {"You're all caught up on pending tasks."}
        </Text>
      ) : (
        <View style={{ marginTop: 10 }}>
          {events.map((ev) => {
            const today = utcTodayKey();
            const overdue = ev.dueDate < today;
            return (
              <View key={ev.id} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: overdue ? '#f87171' : primaryHex }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
                    {ev.title}
                  </Text>
                  <Text style={[typography.caption, { color: overdue ? '#b91c1c' : colors.textMuted, marginTop: 2 }]}>
                    {overdue ? 'Overdue · ' : ''}Due {ev.dueDate}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
      <Text style={[typography.caption, { color: primaryHex, marginTop: 12 }]}>Open full schedule ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
