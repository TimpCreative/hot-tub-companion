import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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

function renderMarkdownLines(markdown: string) {
  return markdown.split('\n').map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <View key={`spacer-${index}`} style={{ height: 12 }} />;
    if (trimmed.startsWith('## ')) {
      return <Text key={index} style={styles.h2}>{trimmed.slice(3)}</Text>;
    }
    if (trimmed.startsWith('# ')) {
      return <Text key={index} style={styles.h1}>{trimmed.slice(2)}</Text>;
    }
    if (trimmed.startsWith('- ')) {
      return <Text key={index} style={styles.bullet}>{`\u2022 ${trimmed.slice(2)}`}</Text>;
    }
    return <Text key={index} style={styles.body}>{trimmed}</Text>;
  });
}

export default function ContentDetailScreen() {
  const { colors } = useTheme();
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
      {item.summary ? <Text style={[styles.summary, { color: colors.textSecondary }]}>{item.summary}</Text> : null}
      {item.author ? <Text style={[styles.author, { color: colors.textMuted }]}>By {item.author}</Text> : null}

      {item.contentType === 'video' && item.videoUrl ? (
        <TouchableOpacity style={[styles.openButton, { backgroundColor: colors.primary }]} onPress={() => Linking.openURL(item.videoUrl!)}>
          <Text style={styles.openButtonText}>Open Video</Text>
        </TouchableOpacity>
      ) : null}

      {item.bodyMarkdown ? (
        <View style={[styles.section, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}>
          {renderMarkdownLines(item.bodyMarkdown)}
        </View>
      ) : null}

      {item.transcript ? (
        <View style={[styles.section, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Transcript</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{item.transcript}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
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
  h1: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  h2: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  body: { fontSize: 15, lineHeight: 24 },
  bullet: { fontSize: 15, lineHeight: 24, paddingLeft: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
