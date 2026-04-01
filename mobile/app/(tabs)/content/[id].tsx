import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import RenderHtml from 'react-native-render-html';
import api from '../../../services/api';
import { useTheme } from '../../../theme/ThemeProvider';

type ContentItem = {
  id: string;
  title: string;
  summary: string | null;
  contentType: 'article' | 'video';
  bodyMarkdown: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  author: string | null;
  transcript: string | null;
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

export default function ContentDetailScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id: string; spaProfileId?: string }>();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<ContentItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = (await api.get(`/content/${params.id}`, {
          params: { spaProfileId: params.spaProfileId },
        })) as { data?: ContentItem };
        if (!cancelled) setItem(res?.data ?? null);
      } catch {
        if (!cancelled) setItem(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id, params.spaProfileId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Content unavailable</Text>
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          This guide could not be loaded for the current spa context.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {item.thumbnailUrl ? <Image source={{ uri: item.thumbnailUrl }} style={styles.image} resizeMode="cover" /> : null}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: item.contentType === 'video' ? '#ede9fe' : '#e0f2fe' }]}>
          <Text style={[styles.badgeText, { color: item.contentType === 'video' ? '#6d28d9' : '#0369a1' }]}>
            {item.contentType === 'video' ? 'Video' : 'Article'}
          </Text>
        </View>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
      {item.summary ? (
        <RenderHtml
          contentWidth={width - 40}
          source={{ html: item.summary }}
          baseStyle={{ color: colors.textSecondary, fontSize: 16, lineHeight: 24 }}
          tagsStyles={htmlStyles(colors).tagsStyles}
        />
      ) : null}
      {item.author ? <Text style={[styles.author, { color: colors.textMuted }]}>By {item.author}</Text> : null}

      {item.contentType === 'video' && item.videoUrl ? (
        <TouchableOpacity style={[styles.openButton, { backgroundColor: colors.primary }]} onPress={() => Linking.openURL(item.videoUrl!)}>
          <Text style={styles.openButtonText}>Open Video</Text>
        </TouchableOpacity>
      ) : null}

      {item.bodyMarkdown ? (
        <View style={[styles.section, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}>
          <RenderHtml
            contentWidth={width - 76}
            source={{ html: item.bodyMarkdown }}
            baseStyle={{ color: colors.text, fontSize: 15, lineHeight: 24 }}
            tagsStyles={htmlStyles(colors).tagsStyles}
          />
        </View>
      ) : null}

      {item.transcript ? (
        <View style={[styles.section, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Transcript</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{stripHtml(item.transcript)}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function htmlStyles(colors: { text: string; textSecondary: string }) {
  return {
    tagsStyles: {
      p: { marginTop: 0, marginBottom: 12, color: colors.textSecondary, lineHeight: 24 },
      strong: { fontWeight: '700' as const, color: colors.text },
      b: { fontWeight: '700' as const, color: colors.text },
      em: { fontStyle: 'italic' as const, color: colors.textSecondary },
      i: { fontStyle: 'italic' as const, color: colors.textSecondary },
      u: { textDecorationLine: 'underline' as const, color: colors.textSecondary },
      h1: { fontSize: 24, fontWeight: '800' as const, marginBottom: 10, color: colors.text },
      h2: { fontSize: 20, fontWeight: '700' as const, marginBottom: 8, color: colors.text },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: '#cbd5e1',
        paddingLeft: 12,
        marginLeft: 0,
        color: colors.textSecondary,
      },
      ul: { marginVertical: 8 },
      ol: { marginVertical: 8 },
      li: { marginBottom: 6, color: colors.textSecondary },
      a: { color: '#2563eb', textDecorationLine: 'underline' as const },
    },
  };
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, gap: 14 },
  image: { width: '100%', height: 220, borderRadius: 18, backgroundColor: '#e5e7eb' },
  badgeRow: { flexDirection: 'row' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800', lineHeight: 34 },
  summary: { fontSize: 16, lineHeight: 24 },
  author: { fontSize: 13 },
  openButton: {
    borderRadius: 14,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  openButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
