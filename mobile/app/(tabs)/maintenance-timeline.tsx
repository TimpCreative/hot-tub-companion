import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeroHeader } from '../../components/AppHeroHeader';
import { StatusBarBar } from '../../components/StatusBarBar';
import { useTheme } from '../../theme/ThemeProvider';
import { useActiveSpa, type SpaProfileListItem } from '../../contexts/ActiveSpaContext';
import { categoryKeyForProductType } from '../../services/shop';
import * as maintenanceApi from '../../services/maintenance';
import type { MaintenanceEvent } from '../../services/maintenance';

function spaLabel(p: SpaProfileListItem | undefined): string {
  if (!p) return 'Spa';
  const n = p.nickname?.trim();
  if (n) return n;
  const b = p.brand?.trim() || '';
  const m = p.model?.trim() || '';
  return `${b} ${m}`.trim() || 'My spa';
}

function utcTodayKey(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;
}

function addDaysKey(dateKey: string, days: number): string {
  const [y, mo, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, mo - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function partitionEvents(events: MaintenanceEvent[]) {
  const today = utcTodayKey();
  const weekEnd = addDaysKey(today, 7);
  const monthEnd = addDaysKey(today, 30);

  const open = events.filter((e) => !e.completedAt);
  const overdue = open.filter((e) => e.dueDate < today);
  const thisWeek = open.filter((e) => e.dueDate >= today && e.dueDate <= weekEnd);
  const upcoming = open.filter((e) => e.dueDate > weekEnd && e.dueDate <= monthEnd);
  return { overdue, thisWeek, upcoming };
}

function shopCategoryKey(linked: string | null | undefined): string | null {
  if (!linked || typeof linked !== 'string') return null;
  const slug = linked.trim().toLowerCase();
  if (!slug) return null;
  return categoryKeyForProductType(slug);
}

export default function MaintenanceTimelineScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { spaProfileId, setSpaProfileId, spaProfiles, refreshSpaProfiles } = useActiveSpa();
  const primaryHex = colors.primary ?? '#1B4D7A';

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [spaModal, setSpaModal] = useState(false);

  const activeSpa = useMemo(
    () => spaProfiles.find((p) => p.id === spaProfileId) ?? spaProfiles[0],
    [spaProfiles, spaProfileId]
  );

  const load = useCallback(async () => {
    if (!spaProfileId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await maintenanceApi.listMaintenanceEvents(spaProfileId, { status: 'pending', pageSize: 150 });
      setEvents(list);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [spaProfileId]);

  useFocusEffect(
    useCallback(() => {
      void refreshSpaProfiles();
      void load();
    }, [load, refreshSpaProfiles])
  );

  const { overdue, thisWeek, upcoming } = useMemo(() => partitionEvents(events), [events]);

  const handleComplete = (ev: MaintenanceEvent) => {
    setCompletingId(ev.id);
    void (async () => {
      try {
        await maintenanceApi.completeMaintenanceEvent(ev.id);
        await load();
        const cat = shopCategoryKey(ev.linkedProductCategory);
        if (cat) {
          Alert.alert('Marked done', 'Need supplies for this task?', [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Shop',
              onPress: () =>
                router.push({
                  pathname: '/(tabs)/shop',
                  params: { categoryKey: cat },
                }),
            },
          ]);
        }
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'error' in err
            ? String((err as { error?: { message?: string } }).error?.message ?? 'Failed')
            : 'Failed to update';
        Alert.alert('Error', msg);
      } finally {
        setCompletingId(null);
      }
    })();
  };

  const highlightId = typeof params.eventId === 'string' ? params.eventId : undefined;

  const renderSection = (title: string, subtitle: string, list: MaintenanceEvent[], tone: 'danger' | 'default' | 'muted') => {
    if (list.length === 0) return null;
    const border =
      tone === 'danger' ? 'rgba(248,113,113,0.45)' : tone === 'muted' ? colors.border : 'rgba(148,163,184,0.35)';
    return (
      <View style={[styles.section, { borderColor: border, backgroundColor: colors.contentBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.sectionSub, { color: colors.textMuted }]}>{subtitle}</Text>
        {list.map((ev) => {
          const hi = highlightId === ev.id;
          return (
            <View
              key={ev.id}
              style={[
                styles.card,
                {
                  borderColor: hi ? colors.primary : colors.border,
                  backgroundColor: hi ? `${colors.primary}12` : colors.background,
                },
              ]}
            >
              <View style={styles.cardTop}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <View style={styles.cardCopy}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{ev.title}</Text>
                  {ev.description ? (
                    <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                      {ev.description}
                    </Text>
                  ) : null}
                  <Text style={[styles.due, { color: colors.textMuted }]}>Due {ev.dueDate}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                disabled={completingId === ev.id}
                onPress={() => handleComplete(ev)}
              >
                {completingId === ev.id ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.doneBtnText}>Mark done</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBarBar primaryColor={primaryHex} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <AppHeroHeader icon="construct-outline" title="Care schedule" subtitle="Mechanical & seasonal tasks" />

        {!spaProfileId ? (
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Add a spa</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Your maintenance schedule is tied to your spa profile.
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/onboarding')}>
              <Text style={styles.primaryBtnText}>Set up my spa</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.spaRow, { borderColor: colors.border, backgroundColor: colors.contentBackground }]}
              onPress={() => setSpaModal(true)}
            >
              <View>
                <Text style={[styles.spaLabel, { color: colors.textMuted }]}>Spa</Text>
                <Text style={[styles.spaName, { color: colors.text }]}>{spaLabel(activeSpa)}</Text>
              </View>
              <Ionicons name="chevron-down" size={22} color={colors.primary} />
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator style={{ marginTop: 24 }} size="large" color={colors.primary} />
            ) : (
              <>
                {renderSection('Overdue', 'Past due — complete when you can', overdue, 'danger')}
                {renderSection('This week', 'Due in the next 7 days', thisWeek, 'default')}
                {renderSection('Upcoming', 'Next 30 days', upcoming, 'muted')}
                {!overdue.length && !thisWeek.length && !upcoming.length ? (
                  <Text style={[styles.allClear, { color: colors.textSecondary }]}>{"You're all caught up on pending tasks."}</Text>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={spaModal} transparent animationType="fade" onRequestClose={() => setSpaModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSpaModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.contentBackground }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose spa</Text>
            {spaProfiles.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.modalRow, { borderColor: colors.border }, p.id === spaProfileId && { backgroundColor: `${colors.primary}18` }]}
                onPress={() => {
                  void setSpaProfileId(p.id);
                  setSpaModal(false);
                }}
              >
                <Text style={[styles.modalRowText, { color: colors.text }]}>{spaLabel(p)}</Text>
                {p.id === spaProfileId ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24 },
  spaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  spaLabel: { fontSize: 12, marginBottom: 4 },
  spaName: { fontSize: 17, fontWeight: '700' },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sectionSub: { fontSize: 14, marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardDesc: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  due: { fontSize: 13, marginTop: 6 },
  doneBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    marginTop: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyBody: { fontSize: 15, lineHeight: 22 },
  primaryBtn: { marginTop: 16, alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  allClear: { textAlign: 'center', marginTop: 12, fontSize: 15 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { borderRadius: 16, padding: 16, maxHeight: '70%' },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  modalRowText: { fontSize: 16, flex: 1 },
});
