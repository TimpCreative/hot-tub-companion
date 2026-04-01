import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import api from '../../services/api';
import { useTheme } from '../../theme/ThemeProvider';

type SpaProfile = {
  id: string;
  isPrimary?: boolean;
};

type ContentItem = {
  id: string;
  title: string;
  summary: string | null;
  contentType: 'article' | 'video';
  thumbnailUrl: string | null;
  categories: Array<{ id: string; key: string; label: string }>;
};

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

function getPrimarySpa(spaProfiles: SpaProfile[]): SpaProfile | null {
  return spaProfiles.find((spa) => spa.isPrimary) ?? spaProfiles[0] ?? null;
}

export default function WaterGuidesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [spaProfileId, setSpaProfileId] = useState<string | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const spaRes = (await api.get('/spa-profiles')) as { data?: { spaProfiles?: SpaProfile[] } };
      const primarySpa = getPrimarySpa(spaRes?.data?.spaProfiles ?? []);
      setSpaProfileId(primarySpa?.id ?? null);
      const contentRes = (await api.get('/content', {
        params: {
          spaProfileId: primarySpa?.id,
          category: 'water_care',
          search: search || undefined,
        },
      })) as { data?: ContentItem[] };
      setItems(contentRes?.data ?? []);
    } catch {
      setItems([]);
      setSpaProfileId(null);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const emptyMessage = useMemo(() => {
    if (!spaProfileId) return 'Finish spa setup to unlock personalized water care guides.';
    if (search.trim()) return 'No matching guides or videos found.';
    return 'No water care guides have been published for this spa yet.';
  }, [search, spaProfileId]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Guides & Videos</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Contextual water care content for your active spa.
        </Text>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search guides and videos"
        placeholderTextColor={colors.textMuted}
        style={[
          styles.searchInput,
          { backgroundColor: colors.contentBackground, borderColor: colors.border, color: colors.text },
        ]}
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing to show yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{emptyMessage}</Text>
        </View>
      ) : (
        <View style={styles.stack}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/content/[id]',
                  params: { id: item.id, spaProfileId: spaProfileId ?? undefined },
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  header: { gap: 6 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
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
});
