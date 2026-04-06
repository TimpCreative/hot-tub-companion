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
  TextInput,
} from 'react-native';
import { Ionicons, type IoniconsProps } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeroHeader } from '../../components/AppHeroHeader';
import { StatusBarBar } from '../../components/StatusBarBar';
import { useTheme } from '../../theme/ThemeProvider';
import { useActiveSpa, type SpaProfileListItem } from '../../contexts/ActiveSpaContext';
import { categoryKeyForProductType } from '../../services/shop';
import api from '../../services/api';
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

function dateKeyToUtcDate(dateKey: string): Date {
  const [y, mo, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, mo - 1, d));
}

/** Monday (UTC) of the calendar week containing dateKey, as YYYY-MM-DD. */
function utcWeekStartMondayKey(dateKey: string): string {
  const dt = dateKeyToUtcDate(dateKey);
  const dow = dt.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() + offset);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatWeekHeading(weekStartKey: string): string {
  const dt = dateKeyToUtcDate(weekStartKey);
  const label = dt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `Week of ${label}`;
}

type UpcomingWeekGroup = { weekStart: string; label: string; events: MaintenanceEvent[] };

function partitionEvents(events: MaintenanceEvent[]) {
  const today = utcTodayKey();
  const weekEnd = addDaysKey(today, 7);
  const monthEnd = addDaysKey(today, 30);

  const open = events.filter((e) => !e.completedAt);
  const overdue = open.filter((e) => e.dueDate < today);
  const thisWeek = open.filter((e) => e.dueDate >= today && e.dueDate <= weekEnd);
  const upcomingFlat = open.filter((e) => e.dueDate > weekEnd && e.dueDate <= monthEnd);

  const byWeek = new Map<string, MaintenanceEvent[]>();
  for (const ev of upcomingFlat) {
    const ws = utcWeekStartMondayKey(ev.dueDate);
    if (!byWeek.has(ws)) byWeek.set(ws, []);
    byWeek.get(ws)!.push(ev);
  }
  const weekStarts = [...byWeek.keys()].sort();
  const upcomingWeeks: UpcomingWeekGroup[] = weekStarts.map((weekStart) => ({
    weekStart,
    label: formatWeekHeading(weekStart),
    events: (byWeek.get(weekStart) ?? []).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  }));

  return { overdue, thisWeek, upcomingWeeks };
}

function iconForEventType(eventType: string | undefined): IoniconsProps['name'] {
  switch (eventType) {
    case 'filter_rinse':
      return 'water-outline';
    case 'filter_deep_clean':
      return 'sparkles-outline';
    case 'filter_replace':
      return 'funnel-outline';
    case 'drain_refill':
      return 'water-outline';
    case 'cover_check':
      return 'umbrella-outline';
    case 'water_test':
      return 'flask-outline';
    case 'winterize':
      return 'snow-outline';
    case 'spring_startup':
      return 'sunny-outline';
    case 'custom':
      return 'create-outline';
    default:
      return 'calendar-outline';
  }
}

type ContentGuideItem = {
  id: string;
  title: string;
  contentType?: string;
};

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
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [guideItems, setGuideItems] = useState<ContentGuideItem[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(false);

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

  const loadGuides = useCallback(async () => {
    if (!spaProfileId) {
      setGuideItems([]);
      return;
    }
    setGuidesLoading(true);
    try {
      const [maintRes, seasonalRes] = await Promise.all([
        api.get('/content', { params: { spaProfileId, category: 'maintenance' } }) as Promise<{ data?: ContentGuideItem[] }>,
        api.get('/content', { params: { spaProfileId, category: 'seasonal' } }) as Promise<{ data?: ContentGuideItem[] }>,
      ]);
      const byId = new Map<string, ContentGuideItem>();
      for (const row of [...(maintRes.data ?? []), ...(seasonalRes.data ?? [])]) {
        if (row?.id && row.title) byId.set(row.id, row);
      }
      setGuideItems([...byId.values()].slice(0, 2));
    } catch {
      setGuideItems([]);
    } finally {
      setGuidesLoading(false);
    }
  }, [spaProfileId]);

  useFocusEffect(
    useCallback(() => {
      void refreshSpaProfiles();
      void load();
      void loadGuides();
    }, [load, loadGuides, refreshSpaProfiles])
  );

  const { overdue, thisWeek, upcomingWeeks } = useMemo(() => partitionEvents(events), [events]);

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

  const openAddTask = () => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskDue(utcTodayKey());
    setTaskModalOpen(true);
  };

  const openEditTask = (ev: MaintenanceEvent) => {
    setEditingTaskId(ev.id);
    setTaskTitle(ev.title);
    setTaskDue(ev.dueDate);
    setTaskModalOpen(true);
  };

  const openCustomTaskMenu = (ev: MaintenanceEvent) => {
    Alert.alert(ev.title, undefined, [
      { text: 'Edit', onPress: () => openEditTask(ev) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete this task?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  const ok = await maintenanceApi.deleteCustomMaintenanceEvent(ev.id);
                  if (ok) await load();
                  else Alert.alert('Error', 'Could not delete task');
                })();
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const saveCustomTask = () => {
    const title = taskTitle.trim();
    const due = taskDue.trim();
    if (!title) {
      Alert.alert('Title required', 'Enter a short name for this task.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD for the due date.');
      return;
    }
    if (!spaProfileId) return;
    setSavingTask(true);
    void (async () => {
      try {
        if (editingTaskId) {
          await maintenanceApi.updateCustomMaintenanceEvent(editingTaskId, { title, dueDate: due });
        } else {
          await maintenanceApi.createCustomMaintenanceEvent({ spaProfileId, title, dueDate: due });
        }
        setTaskModalOpen(false);
        await load();
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'error' in err
            ? String((err as { error?: { message?: string } }).error?.message ?? 'Failed')
            : 'Could not save task';
        Alert.alert('Error', msg);
      } finally {
        setSavingTask(false);
      }
    })();
  };

  const renderEventCard = (ev: MaintenanceEvent) => {
    const hi = highlightId === ev.id;
    const iconName = iconForEventType(ev.eventType);
    const isCustom = ev.source === 'custom';
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
          <Ionicons name={iconName} size={22} color={colors.primary} />
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{ev.title}</Text>
            {ev.description ? (
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                {ev.description}
              </Text>
            ) : null}
            <Text style={[styles.due, { color: colors.textMuted }]}>Due {ev.dueDate}</Text>
          </View>
          {isCustom ? (
            <TouchableOpacity onPress={() => openCustomTaskMenu(ev)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
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
  };

  const renderSection = (title: string, subtitle: string, list: MaintenanceEvent[], tone: 'danger' | 'default' | 'muted') => {
    if (list.length === 0) return null;
    const border =
      tone === 'danger' ? 'rgba(248,113,113,0.45)' : tone === 'muted' ? colors.border : 'rgba(148,163,184,0.35)';
    return (
      <View style={[styles.section, { borderColor: border, backgroundColor: colors.contentBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.sectionSub, { color: colors.textMuted }]}>{subtitle}</Text>
        {list.map((ev) => renderEventCard(ev))}
      </View>
    );
  };

  const renderUpcomingByWeek = () => {
    if (upcomingWeeks.length === 0) return null;
    const border = colors.border;
    return (
      <View style={[styles.section, { borderColor: border, backgroundColor: colors.contentBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming</Text>
        <Text style={[styles.sectionSub, { color: colors.textMuted }]}>Next 30 days, by week</Text>
        {upcomingWeeks.map((group) => (
          <View key={group.weekStart} style={styles.weekBlock}>
            <Text style={[styles.weekLabel, { color: colors.textSecondary }]}>{group.label}</Text>
            {group.events.map((ev) => renderEventCard(ev))}
          </View>
        ))}
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

            <TouchableOpacity
              style={[styles.addTaskRow, { borderColor: colors.border, backgroundColor: colors.contentBackground }]}
              onPress={openAddTask}
            >
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              <Text style={[styles.addTaskText, { color: colors.text }]}>Add custom task</Text>
            </TouchableOpacity>

            <View style={[styles.guideSection, { borderColor: colors.border, backgroundColor: colors.contentBackground }]}>
              <Text style={[styles.guideSectionTitle, { color: colors.text }]}>Guides</Text>
              <Text style={[styles.guideSectionSub, { color: colors.textMuted }]}>
                Maintenance and seasonal topics for your spa
              </Text>
              {guidesLoading ? (
                <ActivityIndicator style={{ marginTop: 8 }} color={colors.primary} />
              ) : guideItems.length > 0 ? (
                guideItems.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.guideRow, { borderColor: colors.border }]}
                    onPress={() =>
                      router.push({
                        pathname: '/(tabs)/content/[id]',
                        params: { id: g.id, spaProfileId: spaProfileId ?? undefined },
                      })
                    }
                  >
                    <Ionicons
                      name={g.contentType === 'video' ? 'play-circle-outline' : 'document-text-outline'}
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={[styles.guideRowTitle, { color: colors.text }]} numberOfLines={2}>
                      {g.title}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.guideEmpty, { color: colors.textSecondary }]}>
                  No published maintenance guides yet — browse the library for more topics.
                </Text>
              )}
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/(tabs)/water-guides', params: { category: 'maintenance' } })
                }
                style={{ marginTop: 10 }}
              >
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Browse all guides ›</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator style={{ marginTop: 24 }} size="large" color={colors.primary} />
            ) : (
              <>
                {renderSection('Overdue', 'Past due — complete when you can', overdue, 'danger')}
                {renderSection('This week', 'Due in the next 7 days', thisWeek, 'default')}
                {renderUpcomingByWeek()}
                {!overdue.length && !thisWeek.length && upcomingWeeks.length === 0 ? (
                  <Text style={[styles.allClear, { color: colors.textSecondary }]}>{"You're all caught up on pending tasks."}</Text>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={taskModalOpen} transparent animationType="fade" onRequestClose={() => setTaskModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !savingTask && setTaskModalOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.contentBackground }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingTaskId ? 'Edit task' : 'New custom task'}
            </Text>
            <Text style={[styles.modalFieldLabel, { color: colors.textMuted }]}>Title</Text>
            <TextInput
              value={taskTitle}
              onChangeText={setTaskTitle}
              placeholder="e.g. Check ozonator"
              placeholderTextColor={colors.textMuted}
              style={[styles.taskInput, { color: colors.text, borderColor: colors.border }]}
            />
            <Text style={[styles.modalFieldLabel, { color: colors.textMuted, marginTop: 12 }]}>Due date (YYYY-MM-DD)</Text>
            <TextInput
              value={taskDue}
              onChangeText={setTaskDue}
              placeholder="2026-04-15"
              placeholderTextColor={colors.textMuted}
              style={[styles.taskInput, { color: colors.text, borderColor: colors.border }]}
            />
            <View style={styles.taskModalActions}>
              <TouchableOpacity
                style={[styles.taskModalBtn, { borderColor: colors.border }]}
                disabled={savingTask}
                onPress={() => setTaskModalOpen(false)}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.taskModalBtn, { backgroundColor: colors.primary }]}
                disabled={savingTask}
                onPress={saveCustomTask}
              >
                {savingTask ? <ActivityIndicator color="#fff" /> : <Text style={styles.taskModalBtnPrimaryText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  addTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  addTaskText: { fontSize: 16, fontWeight: '600' },
  guideSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  guideSectionTitle: { fontSize: 17, fontWeight: '700' },
  guideSectionSub: { fontSize: 13, marginTop: 4, marginBottom: 8 },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  guideRowTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  guideEmpty: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  modalFieldLabel: { fontSize: 12, marginBottom: 6 },
  taskInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  taskModalActions: { flexDirection: 'row', gap: 12, marginTop: 20, justifyContent: 'flex-end' },
  taskModalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  taskModalBtnPrimaryText: { color: '#fff', fontWeight: '700' },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sectionSub: { fontSize: 14, marginBottom: 12 },
  weekBlock: { marginBottom: 8 },
  weekLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 4 },
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
