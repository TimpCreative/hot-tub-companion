import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import RenderHtml from 'react-native-render-html';
import { useFocusEffect } from '@react-navigation/native';
import { formatProductPriceCents } from '../../../lib/formatProductPrice';
import {
  fetchProductDetail,
  fetchShopRelatedProducts,
  type ProductDetail,
  type ShopCompatibility,
  type ShopProductRow,
} from '../../../services/shop';
import { messageFromApiReject } from '../../../services/cart';
import { useTheme } from '../../../theme/ThemeProvider';
import { useAuth } from '../../../contexts/AuthContext';
import { useCart } from '../../../contexts/CartContext';
import { useTenant } from '../../../contexts/TenantContext';
import { productDetailStockLine } from '../../../lib/formatProductStock';
import { useActiveSpa } from '../../../contexts/ActiveSpaContext';

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
  const router = useRouter();
  const { user } = useAuth();
  const { config: tenantConfig } = useTenant();
  const { addToCart } = useCart();
  const params = useLocalSearchParams<{ id: string }>();
  const { spaProfileId, refreshSpaProfiles } = useActiveSpa();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingCart, setAddingCart] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [related, setRelated] = useState<ShopProductRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      void refreshSpaProfiles();
    }, [refreshSpaProfiles])
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

  useEffect(() => {
    if (!params.id || !product) return;
    setSelectedVariantId(params.id);
  }, [params.id, product?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadRelated() {
      if (!params.id || !user) {
        setRelated([]);
        return;
      }
      try {
        const res = await fetchShopRelatedProducts(params.id, {
          spaProfileId,
          limit: 8,
          includeOtherSpaParts: false,
          includeGeneralStore: true,
          hideOutOfStock: true,
        });
        if (!cancelled) setRelated(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setRelated([]);
      }
    }
    void loadRelated();
    return () => {
      cancelled = true;
    };
  }, [params.id, spaProfileId, user]);

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

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const activeVariantId = selectedVariantId ?? product.id;
  const variantRow =
    variants.find((v) => v.id === activeVariantId) ??
    (variants.length ? variants[0] : null);
  const displayPrice = variantRow?.price ?? product.price;
  const displayCompare = variantRow?.compare_at_price ?? product.compare_at_price;
  const stock = variantRow?.inventory_quantity ?? product.inventory_quantity ?? 0;

  const compare =
    displayCompare != null && Number(displayCompare) > Number(displayPrice);
  const stockLine = productDetailStockLine(stock, tenantConfig?.shop ?? null);

  const handleAddToCart = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to add items to your cart.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }
    if (stock <= 0) {
      Alert.alert('Out of stock', 'This item is not available right now.');
      return;
    }
    const lineProductId = activeVariantId;
    setAddingCart(true);
    try {
      await addToCart(lineProductId, 1);
      Alert.alert('Added to cart', 'View your cart to check out.', [
        { text: 'Keep shopping', style: 'cancel' },
        { text: 'View cart', onPress: () => router.push('/(tabs)/shop/cart') },
      ]);
    } catch (e) {
      Alert.alert('Cart', messageFromApiReject(e, 'Could not add to cart.'));
    } finally {
      setAddingCart(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
    >
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.heroCarousel}
      >
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

      {variants.length > 1 ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 8, fontWeight: '600' }]}>
            Choose option
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {variants.map((v) => {
              const sel = v.id === activeVariantId;
              const oos = (v.inventory_quantity ?? 0) <= 0;
              const label = (v.sku && v.sku.trim()) || v.title;
              return (
                <Pressable
                  key={v.id}
                  disabled={oos}
                  onPress={() => setSelectedVariantId(v.id)}
                  style={[
                    styles.variantChip,
                    {
                      borderColor: sel ? colors.primary : colors.border,
                      backgroundColor: sel ? colors.primary + '22' : colors.surface,
                      opacity: oos ? 0.45 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[typography.body, { color: colors.text, fontWeight: sel ? '700' : '500', maxWidth: 160 }]}
                    numberOfLines={2}
                  >
                    {label}
                    {oos ? ' · Out of stock' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: colors.primary }]}>{formatProductPriceCents(displayPrice)}</Text>
        {compare ? (
          <Text style={[styles.compare, { color: colors.textSecondary, textDecorationLine: 'line-through' }]}>
            {formatProductPriceCents(displayCompare ?? 0)}
          </Text>
        ) : null}
      </View>

      {stockLine ? (
        <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>{stockLine}</Text>
      ) : null}

      {descHtml ? (
        <RenderHtml
          contentWidth={width - 40}
          source={{ html: descHtml }}
          baseStyle={{ color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}
          tagsStyles={htmlStyles(colors).tagsStyles}
        />
      ) : null}

      {related.length > 0 ? (
        <View style={{ marginTop: 28 }}>
          <Text style={[typography.body, { color: colors.text, fontWeight: '800', marginBottom: 12 }]}>
            You may also need
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {related.map((r) => {
              const img = firstImageUrls(r.images)[0];
              return (
                <Pressable
                  key={r.id}
                  onPress={() => router.push(`/(tabs)/shop/${r.id}`)}
                  style={[
                    styles.relatedCard,
                    { borderColor: colors.border, backgroundColor: colors.surface, width: 132 },
                  ]}
                >
                  {img ? (
                    <Image source={{ uri: img }} style={styles.relatedThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.relatedThumb, { backgroundColor: colors.border }]} />
                  )}
                  <Text style={[typography.caption, { color: colors.text, fontWeight: '600', marginTop: 8 }]} numberOfLines={2}>
                    {r.title}
                  </Text>
                  <Text style={[typography.caption, { color: colors.primary, marginTop: 4, fontWeight: '700' }]}>
                    {formatProductPriceCents(r.price)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.ctaRow}>
        <Pressable
          style={({ pressed }) => [
            styles.cta,
            { flex: 1, minWidth: 0 },
            {
              backgroundColor: stock > 0 ? colors.primary : colors.border,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
          disabled={stock <= 0 || addingCart}
          onPress={() => void handleAddToCart()}
        >
          {addingCart ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={[
                styles.ctaText,
                { color: stock > 0 ? '#fff' : '#6b7280' },
              ]}
            >
              {stock <= 0 ? 'Out of stock' : 'Add to cart'}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  /** Top inset 0 so the hero sits flush under the stack header; horizontal bleed matches body padding. */
  content: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 40 },
  heroCarousel: { marginHorizontal: -16 },
  heroPlaceholder: { height: 280 },
  compatBanner: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  title: { fontSize: 24, fontWeight: '800', marginTop: 16, lineHeight: 30 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 8 },
  price: { fontSize: 22, fontWeight: '800' },
  compare: { fontSize: 16 },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  cta: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 14, fontWeight: '700', color: '#6b7280', textAlign: 'center' },
  variantChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: 200,
  },
  relatedCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  relatedThumb: {
    width: '100%',
    height: 88,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
});
