import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import api from '../../services/api';
import { useTheme } from '../../theme/ThemeProvider';

type ProductRow = {
  id: string;
  title: string;
  price?: string | number | null;
  images?: unknown;
};

function firstImageUrl(images: unknown): string | null {
  if (!images) return null;
  if (Array.isArray(images) && images.length > 0 && typeof images[0] === 'string') {
    return images[0];
  }
  if (typeof images === 'object' && images !== null && 'url' in images) {
    const u = (images as { url?: string }).url;
    return typeof u === 'string' ? u : null;
  }
  return null;
}

function formatPrice(p: string | number | null | undefined): string {
  if (p == null || p === '') return '';
  const n = typeof p === 'string' ? parseFloat(p) : p;
  if (Number.isNaN(n)) return String(p);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
}

export interface ProductStripProps {
  title: string;
  subtitle?: string;
  sanitizationLabel?: string | null;
}

export function ProductStripWidget({ title, subtitle, sanitizationLabel }: ProductStripProps) {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await api.get('/products', { params: { page: 1, pageSize: 8 } })) as {
        data?: ProductRow[];
      };
      const rows = Array.isArray(res?.data) ? res.data : [];
      setProducts(rows);
    } catch {
      setProducts([]);
      setError('Unable to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[typography.h2, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>{subtitle}</Text>
      ) : null}
      {sanitizationLabel ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>
          For {sanitizationLabel.replace(/_/g, ' ')} systems
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />
      ) : error ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>{error}</Text>
      ) : products.length === 0 ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
          No products yet — check back soon.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: spacing.md, paddingRight: spacing.md }}
        >
          {products.map((p) => {
            const img = firstImageUrl(p.images);
            return (
              <Pressable
                key={p.id}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.9 : 1,
                    marginRight: spacing.sm,
                  },
                ]}
                onPress={() => router.push('/shop' as Href)}
              >
                {img ? (
                  <Image source={{ uri: img }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: colors.border }]} />
                )}
                <Text numberOfLines={2} style={[typography.caption, { color: colors.text, marginTop: 8, maxWidth: 140 }]}>
                  {p.title}
                </Text>
                {p.price != null && p.price !== '' ? (
                  <Text style={[typography.body, { color: colors.primary, marginTop: 4, fontWeight: '600' }]}>
                    {formatPrice(p.price)}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 156,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  thumb: {
    width: '100%',
    height: 100,
    borderRadius: 8,
  },
});
