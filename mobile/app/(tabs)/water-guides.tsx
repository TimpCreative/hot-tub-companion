import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeroHeader } from '../../components/AppHeroHeader';
import { StatusBarBar } from '../../components/StatusBarBar';
import { useActiveSpa, type SpaProfileListItem } from '../../contexts/ActiveSpaContext';
import api from '../../services/api';
import { useTheme } from '../../theme/ThemeProvider';

const { width: SCREEN_W } = Dimensions.get('window');

type ContentItem = {
  id: string;
  title: string;
  summary: string | null;
  contentType: 'article' | 'video';
  thumbnailUrl: string | null;
  categories: Array<{ id: string; key: string; label: string }>;
};

type GuideTab = 'all' | 'water_care' | 'maintenance_seasonal';
type ContentKindFilter = 'all' | 'article' | 'video';

function stripHtml(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/<\/(p|div|li|blockquote|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function spaBrowsingLabel(p: SpaProfileListItem | undefined): string {
  if (!p) return 'Spa';
  const y = p.year != null && Number.isFinite(Number(p.year)) ? String(p.year) : '';
  const b = p.brand?.trim() || '';
  const m = (p.modelLine?.trim() || p.model?.trim() || '') as string;
  const structured = [y, b, m].filter(Boolean).join(' ').trim();
  if (structured) return structured;
  const n = p.nickname?.trim();
  return n || 'My spa';
}

function itemMatchesTab(item: ContentItem, tab: GuideTab): boolean {
  if (tab === 'all') return true;
  const keys = item.categories.map((c) => c.key);
  if (tab === 'water_care') return keys.includes('water_care');
  return keys.includes('maintenance') || keys.includes('seasonal');
}

export default function WaterGuidesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { category: categoryParam } = useLocalSearchParams<{ category?: string }>();
  const { colors, typography } = useTheme();
  const { spaProfileId, setSpaProfileId, spaProfiles } = useActiveSpa();
  const primaryHex = colors.primary ?? '#1B4D7A';

  const [activeTab, setActiveTab] = useState<GuideTab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContentItem[]>([]);

  const [matchMySpa, setMatchMySpa] = useState(true);
  const [contentKind, setContentKind] = useState<ContentKindFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const panelX = useRef(new Animated.Value(SCREEN_W)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const rawCategory =
    typeof categoryParam === 'string'
      ? categoryParam
      : Array.isArray(categoryParam) && typeof categoryParam[0] === 'string'
        ? categoryParam[0]
        : undefined;

  useEffect(() => {
    if (rawCategory === 'maintenance' || rawCategory === 'seasonal') {
      setActiveTab('maintenance_seasonal');
    }
  }, [rawCategory]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 320);
    return () => clearTimeout(t);
  }, [search]);

  const effectiveSpaId = matchMySpa ? spaProfileId : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (effectiveSpaId) params.spaProfileId = effectiveSpaId;
      const q = debouncedSearch.trim();
      if (q) params.search = q;
      if (contentKind !== 'all') params.type = contentKind;

      const contentRes = (await api.get('/content', { params })) as { data?: ContentItem[] };
      setItems(contentRes?.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveSpaId, debouncedSearch, contentKind]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openFilters = useCallback(() => {
    panelX.setValue(SCREEN_W);
    setFilterOpen(true);
    requestAnimationFrame(() => {
      Animated.spring(panelX, { toValue: 0, useNativeDriver: true, friction: 9 }).start();
    });
  }, [panelX]);

  const closeFilters = useCallback(() => {
    Animated.timing(panelX, { toValue: SCREEN_W, duration: 220, useNativeDriver: true }).start(() =>
      setFilterOpen(false)
    );
  }, [panelX]);

  const clearFilters = useCallback(() => {
    setMatchMySpa(true);
    setContentKind('all');
  }, []);

  const displayedItems = useMemo(
    () => items.filter((item) => itemMatchesTab(item, activeTab)),
    [items, activeTab]
  );

  const activeSpa = useMemo(
    () => spaProfiles.find((p) => p.id === spaProfileId) ?? spaProfiles[0],
    [spaProfiles, spaProfileId]
  );

  const emptyMessage = useMemo(() => {
    if (items.length === 0) {
      if (debouncedSearch.trim()) return 'No matching guides or videos found.';
      if (matchMySpa && !spaProfileId) return 'Add a spa to personalize guides, or turn off “Match my spa” in filters to see all content.';
      return 'No guides have been published yet.';
    }
    if (displayedItems.length === 0) {
      return 'Nothing in this category. Try another tab or clear search.';
    }
    return '';
  }, [items.length, displayedItems.length, debouncedSearch, matchMySpa, spaProfileId]);

  const detailSpaProfileId = matchMySpa && spaProfileId ? spaProfileId : undefined;

  const tabDefs: { key: GuideTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'water_care', label: 'Water care' },
    { key: 'maintenance_seasonal', label: 'Maintenance & seasonal' },
  ];

  const goBackToWaterCare = useCallback(() => {
    router.replace('/(tabs)/water-care' as Href);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBarBar primaryColor={primaryHex} scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <AppHeroHeader
          onBackPress={goBackToWaterCare}
          icon="play-circle-outline"
          title="Guides & Videos"
          subtitle="Articles and videos for water care, maintenance & seasonal tasks"
        />

        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search guides and videos"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.search,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.contentBackground, flex: 1 },
            ]}
          />
          <Pressable
            onPress={openFilters}
            style={({ pressed }) => [
              styles.filterBtn,
              { borderColor: colors.border, backgroundColor: colors.contentBackground, opacity: pressed ? 0.88 : 1 },
            ]}
            accessibilityLabel="Open filters"
          >
            <Ionicons name="menu-outline" size={26} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
          style={styles.tabScroll}
        >
          {tabDefs.map((t) => {
            const sel = activeTab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                style={({ pressed }) => [
                  styles.tabChip,
                  {
                    borderColor: sel ? colors.primary : colors.border,
                    backgroundColor: sel ? `${colors.primary}22` : colors.contentBackground,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[typography.caption, { color: colors.text, fontWeight: sel ? '700' : '500' }]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : displayedItems.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing to show yet</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{emptyMessage}</Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {displayedItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/content/[id]',
                    params: {
                      id: item.id,
                      ...(detailSpaProfileId ? { spaProfileId: detailSpaProfileId } : {}),
                    },
                  })
                }
              >
                {item.thumbnailUrl ? <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} /> : null}
                <View style={styles.cardBody}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: item.contentType === 'video' ? '#ede9fe' : '#e0f2fe' }]}>
                      <Text style={[styles.badgeText, { color: item.contentType === 'video' ? '#6d28d9' : '#0369a1' }]}>
                        {item.contentType === 'video' ? 'Video' : 'Article'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  {item.summary ? (
                    <Text style={[styles.copy, { color: colors.textSecondary }]} numberOfLines={3}>
                      {stripHtml(item.summary)}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.ScrollView>

      <Modal visible={filterOpen} animationType="none" transparent statusBarTranslucent onRequestClose={closeFilters}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeFilters} />
          <View style={styles.filterKeyboard}>
            <Animated.View
              style={[
                styles.filterPanel,
                {
                  backgroundColor: colors.contentBackground,
                  borderLeftColor: colors.border,
                  paddingBottom: insets.bottom + 16,
                  transform: [{ translateX: panelX }],
                },
              ]}
            >
              <View style={[styles.filterHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
                <Text style={[typography.h2, { color: colors.text, fontSize: 20 }]}>Filters</Text>
                <Pressable onPress={closeFilters} hitSlop={12}>
                  <Ionicons name="close" size={28} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView
                style={styles.filterScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={[styles.filterSectionLabel, { color: colors.textMuted }]}>Compatibility</Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 6 }]}>
                  <Text style={{ fontWeight: '700', color: colors.text }}>Browsing for:</Text> {spaBrowsingLabel(activeSpa)}
                </Text>
                {spaProfiles.length > 1 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 12 }}
                    contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}
                    nestedScrollEnabled
                  >
                    {spaProfiles.map((p) => {
                      const sel = p.id === spaProfileId;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => void setSpaProfileId(p.id)}
                          style={({ pressed }) => [
                            styles.filterSpaChip,
                            {
                              borderColor: sel ? colors.primary : colors.border,
                              backgroundColor: sel ? `${colors.primary}22` : colors.surface,
                              opacity: pressed ? 0.88 : 1,
                            },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              typography.caption,
                              { color: colors.text, fontWeight: sel ? '700' : '500', maxWidth: 200 },
                            ]}
                          >
                            {spaBrowsingLabel(p)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}
                <View style={styles.toggleRow}>
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Match my spa</Text>
                  <Switch value={matchMySpa} onValueChange={setMatchMySpa} />
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 16, marginTop: -6 }]}>
                  When on, hides guides and videos that are not targeted to your spa. Turn off to see all published
                  content.
                </Text>

                <Text style={[styles.filterSectionLabel, { color: colors.textMuted, marginTop: 8 }]}>Content type</Text>
                <View style={styles.kindRow}>
                  {(
                    [
                      { key: 'all' as const, label: 'All' },
                      { key: 'video' as const, label: 'Videos' },
                      { key: 'article' as const, label: 'Articles' },
                    ] as const
                  ).map((opt) => {
                    const sel = contentKind === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => setContentKind(opt.key)}
                        style={({ pressed }) => [
                          styles.kindChip,
                          {
                            borderColor: sel ? colors.primary : colors.border,
                            backgroundColor: sel ? `${colors.primary}22` : colors.surface,
                            opacity: pressed ? 0.88 : 1,
                          },
                        ]}
                      >
                        <Text style={[typography.caption, { color: colors.text, fontWeight: sel ? '700' : '500' }]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              <View style={[styles.filterFooter, { borderTopColor: colors.border }]}>
                <Pressable
                  onPress={clearFilters}
                  style={({ pressed }) => [
                    styles.footerBtnClear,
                    { borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>Clear all filters</Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, gap: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  filterBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabScroll: { marginHorizontal: -4 },
  tabRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  tabChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 4,
  },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 18 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyBody: { fontSize: 15, lineHeight: 22 },
  stack: { gap: 14 },
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  thumbnail: { width: '100%', height: 180, backgroundColor: '#e5e7eb' },
  cardBody: { padding: 16, gap: 10 },
  badgeRow: { flexDirection: 'row' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  copy: { fontSize: 15, lineHeight: 22 },
  modalRoot: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  filterKeyboard: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  filterPanel: {
    width: Math.min(SCREEN_W * 0.92, 420),
    maxWidth: '100%',
    borderLeftWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: -4, height: 0 },
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  filterScroll: { flexGrow: 0, maxHeight: '82%', paddingHorizontal: 20, paddingTop: 12 },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  filterSpaChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  kindChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterFooter: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  footerBtnClear: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
