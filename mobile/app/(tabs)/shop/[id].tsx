import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import RenderHtml from 'react-native-render-html';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../../services/api';
import { fetchProductDetail, type ProductDetail, type ShopCompatibility } from '../../../services/shop';
import { useTheme } from '../../../theme/ThemeProvider';

type SpaProfile = { id: string; isPrimary?: boolean };

function pickPrimary(profiles: SpaProfile[]): SpaProfile | null {
  return profiles.find((p) => p.isPrimary) ?? profiles[0] ?? null;
}

function firstImageUrls(images: unknown): string[] {
  if (!images) return [];
  if (Array.isArray(images)) {
    return images
      .map((x) => {
        if (typeof x === 'string') return x;
        if (typeof x === 'object' && x !== null && 'url' in x) {
          const u = (x as { url?: string }).url;
          return typeof u === 'string' ? u : null;
        }
        return null;
      })
      .filter((x): x is string => !!x);
  }
  return [];
}

function formatPrice(p: number | null | undefined): string {
  if (p == null) return '';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(p));
}

function compatCopy(status: ShopCompatibility | undefined): { text: string; tone: 'ok' | 'warn' | 'muted' } {
  switch (status) {
    case 'other_model':
      return { text: 'Not compatible with your spa', tone: 'warn' };
    case 'compatible':
      return { text: 'Compatible with your spa', tone: 'ok' };
    case 'general':
      return { text: 'General store product', tone: 'muted' };
    case 'needs_spa':
      return { text: 'Finish spa setup to confirm fit for your model', tone: 'muted' };
    default:
      return { text: '', tone: 'muted' };
  }
}

function htmlStyles(colors: { text: string; textSecondary: string }) {
  return {
    tagsStyles: {
      p: { marginTop: 0, marginBottom: 12, color: colors.textSecondary, lineHeight: 24 },
      strong: { fontWeight: '700' as const, color: colors.text },
      b: { fontWeight: '700' as const, color: colors.text },
      ul: { marginVertical: 8 },
      ol: { marginVertical: 8 },
      li: { marginBottom: 6, color: colors.textSecondary },
      a: { color: '#2563eb', textDecorationLine: 'underline' as const },
    },
  };
}

export default function ProductDetailScreen() {
  const { colors, typography } = useTheme();
  const { width } = Dimensions.get('window');
  const params = useLocalSearchParams<{ id: string }>();
  const [spaProfileId, setSpaProfileId] = useState<string | undefined>(undefined);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSpa = useCallback(async () => {
    try {
      const res = (await api.get('/spa-profiles')) as { data?: { spaProfiles?: SpaProfile[] } };
      const list = res?.data?.spaProfiles ?? [];
      setSpaProfileId(pickPrimary(list)?.id);
    } catch {
      setSpaProfileId(undefined);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSpa();
    }, [loadSpa])
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!params.id) return;
      setLoading(true);
      try {
        const res = await fetchProductDetail(params.id, spaProfileId);
        if (!cancelled) setProduct(res.data ?? null);
      } catch {
        if (!cancelled) setProduct(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id, spaProfileId]);

  const images = useMemo(() => firstImageUrls(product?.images), [product?.images]);
  const compat = useMemo(() => compatCopy(product?.shopCompatibility), [product?.shopCompatibility]);
  const descHtml = useMemo(() => {
    const d = product?.description;
    if (!d || typeof d !== 'string') return '';
    const trimmed = d.trim();
    if (trimmed.startsWith('<')) return trimmed;
    return `<p>${trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
  }, [product?.description]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={[typography.body, { color: colors.text }]}>Product not found.</Text>
      </View>
    );
  }

  const compare = product.compare_at_price != null && Number(product.compare_at_price) > Number(product.price);
  const stock = product.inventory_quantity ?? 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}>
        {images.length > 0 ? (
          images.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width, height: width * 0.85 }} resizeMode="cover" />
          ))
        ) : (
          <View style={[styles.heroPlaceholder, { width, backgroundColor: colors.border }]} />
        )}
      </ScrollView>

      {compat.text ? (
        <View
          style={[
            styles.compatBanner,
            {
              backgroundColor:
                compat.tone === 'warn' ? '#fef3c7' : compat.tone === 'ok' ? '#d1fae5' : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{
              color: compat.tone === 'warn' ? '#92400e' : compat.tone === 'ok' ? '#065f46' : colors.textSecondary,
              fontWeight: '600',
            }}
          >
            {compat.text}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.title, { color: colors.text }]}>{product.title}</Text>

      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: colors.primary }]}>{formatPrice(product.price)}</Text>
        {compare ? (
          <Text style={[styles.compare, { color: colors.textSecondary, textDecorationLine: 'line-through' }]}>
            {formatPrice(Number(product.compare_at_price))}
          </Text>
        ) : null}
      </View>

      <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
        {stock <= 0 ? 'Out of stock' : stock <= 5 ? `Only ${stock} left` : 'In stock'}
      </Text>

      {descHtml ? (
        <RenderHtml
          contentWidth={width - 40}
          source={{ html: descHtml }}
          baseStyle={{ color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}
          tagsStyles={htmlStyles(colors).tagsStyles}
        />
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: colors.border, opacity: pressed ? 0.9 : 1 },
        ]}
        disabled
      >
        <Text style={styles.ctaText}>Add to cart — coming soon</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  heroPlaceholder: { height: 280 },
  compatBanner: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  title: { fontSize: 24, fontWeight: '800', marginTop: 16, lineHeight: 30 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 8 },
  price: { fontSize: 22, fontWeight: '800' },
  compare: { fontSize: 16 },
  cta: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#6b7280' },
});
