import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppPageHeader } from '../../components/AppPageHeader';
import { FinishSetupBanner } from '../../components/FinishSetupBanner';
import { useFinishSetupNudge } from '../../hooks/useFinishSetupNudge';
import { useTheme } from '../../theme/ThemeProvider';
import api from '../../services/api';
import {
  categoryKeyForProductType,
  categoryKeyForUhtdCategory,
  fetchShopCategories,
  fetchShopProducts,
  type ShopCategory,
  type ShopProductRow,
} from '../../services/shop';

type SpaProfile = { id: string; isPrimary?: boolean };

function pickPrimary(profiles: SpaProfile[]): SpaProfile | null {
  return profiles.find((p) => p.isPrimary) ?? profiles[0] ?? null;
}

function firstImageUrl(images: unknown): string | null {
  if (!images) return null;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === 'string') return first;
    if (typeof first === 'object' && first !== null && 'url' in first) {
      const u = (first as { url?: string }).url;
      return typeof u === 'string' ? u : null;
    }
  }
  return null;
}

function formatPrice(p: number | null | undefined): string {
  if (p == null) return '';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(p));
}

const PAGE_SIZE = 20;

export default function Shop() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productId?: string }>();
  const { colors, typography, spacing } = useTheme();
  const { showNudge, dismiss } = useFinishSetupNudge();

  const redirectedRef = useRef(false);
  useEffect(() => {
    const pid = typeof params.productId === 'string' ? params.productId : undefined;
    if (pid && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace(`/(tabs)/shop/${pid}` as Href);
    }
  }, [params.productId, router]);

  const [spaProfileId, setSpaProfileId] = useState<string | undefined>(undefined);
  const [includeOtherSpaParts, setIncludeOtherSpaParts] = useState(false);
  const [includeGeneralStore, setIncludeGeneralStore] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [products, setProducts] = useState<ShopProductRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 320);
    return () => clearTimeout(t);
  }, [search]);

  const loadSpa = useCallback(async () => {
    try {
      const res = (await api.get('/spa-profiles')) as { data?: { spaProfiles?: SpaProfile[] } };
      const list = res?.data?.spaProfiles ?? [];
      const primary = pickPrimary(list);
      setSpaProfileId(primary?.id);
    } catch {
      setSpaProfileId(undefined);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSpa();
    }, [loadSpa])
  );

  const shopParams = useMemo(
    () => ({
      spaProfileId,
      includeOtherSpaParts,
      includeGeneralStore,
      search: debouncedSearch,
      categoryKey,
    }),
    [spaProfileId, includeOtherSpaParts, includeGeneralStore, debouncedSearch, categoryKey]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchShopCategories({
          spaProfileId,
          includeOtherSpaParts,
          includeGeneralStore,
        });
        if (!cancelled) setCategories(res.data ?? []);
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaProfileId, includeOtherSpaParts, includeGeneralStore]);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      setError(null);
      try {
        const res = await fetchShopProducts({
          spaProfileId,
          includeOtherSpaParts,
          includeGeneralStore,
          page: pageNum,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
          categoryKey,
        });
        if (!res.success) {
          setError('Could not load products.');
          return;
        }
        const rows = res.data ?? [];
        const tp = res.pagination?.totalPages ?? 1;
        setTotalPages(tp);
        setPage(pageNum);
        if (append) {
          setProducts((prev) => [...prev, ...rows]);
        } else {
          setProducts(rows);
        }
      } catch (e: unknown) {
        let msg: string | null = null;
        if (typeof e === 'object' && e !== null && 'error' in e) {
          const err = (e as { error?: { message?: string } | string }).error;
          msg = typeof err === 'string' ? err : err?.message ?? null;
        }
        setError(msg || 'Sign in to browse the shop.');
        if (!append) setProducts([]);
      }
    },
    [spaProfileId, includeOtherSpaParts, includeGeneralStore, debouncedSearch, categoryKey]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchPage(1, false);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      await fetchPage(page + 1, true);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loading, loadingMore, page, totalPages]);

  const renderItem = ({ item }: { item: ShopProductRow }) => {
    const img = firstImageUrl(item.images);
    const out = item.inventory_quantity <= 0;
    const badCompat = item.shop_compatibility === 'other_model';
    const needsSpa = item.shop_compatibility === 'needs_spa';
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.92 : 1,
            flex: 1,
            maxWidth: '48%',
            marginBottom: spacing.md,
          },
        ]}
        onPress={() => router.push(`/(tabs)/shop/${item.id}` as Href)}
      >
        <View style={styles.cardImageWrap}>
          {img ? <Image source={{ uri: img }} style={styles.cardImage} resizeMode="cover" /> : <View style={[styles.cardImage, { backgroundColor: colors.border }]} />}
          {out ? (
            <View style={styles.outOverlay}>
              <Text style={styles.outText}>Out of stock</Text>
            </View>
          ) : null}
        </View>
        {badCompat ? (
          <Text style={[styles.compatBadge, { color: '#b45309' }]} numberOfLines={2}>
            Not compatible with your spa
          </Text>
        ) : null}
        {needsSpa ? (
          <Text style={[styles.compatBadge, { color: colors.textSecondary }]} numberOfLines={2}>
            Add spa details to see if this fits your model
          </Text>
        ) : null}
        <Text numberOfLines={2} style={[typography.caption, { color: colors.text, marginTop: 6 }]}>
          {item.title}
        </Text>
        <Text style={[typography.body, { color: colors.primary, fontWeight: '700', marginTop: 4 }]}>
          {formatPrice(item.price)}
        </Text>
      </Pressable>
    );
  };

  const header = (
    <View style={{ paddingBottom: spacing.md }}>
      <AppPageHeader title="Shop" subtitle="Parts and products from your dealer" />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search title or description"
        placeholderTextColor={colors.textMuted}
        style={[
          styles.search,
          { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
        ]}
      />

      <View style={styles.toggleRow}>
        <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Include parts for other spa models</Text>
        <Switch value={includeOtherSpaParts} onValueChange={setIncludeOtherSpaParts} />
      </View>
      <View style={styles.toggleRow}>
        <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Include general store products</Text>
        <Switch value={includeGeneralStore} onValueChange={setIncludeGeneralStore} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
        <Pressable
          onPress={() => setCategoryKey(null)}
            style={[styles.pill, { borderColor: colors.border, backgroundColor: categoryKey === null ? colors.primary + '22' : colors.surface }]}
        >
          <Text style={{ color: colors.text, fontWeight: '600' }}>All</Text>
        </Pressable>
        {categories.map((c) => {
          const key = c.kind === 'uhtd' ? categoryKeyForUhtdCategory(c.id) : categoryKeyForProductType(c.key);
          const sel = categoryKey === key;
          return (
            <Pressable
              key={`${c.kind}:${c.kind === 'uhtd' ? c.id : c.key}`}
              onPress={() => setCategoryKey(key)}
              style={[styles.pill, { borderColor: colors.border, backgroundColor: sel ? colors.primary + '22' : colors.surface }]}
            >
              <Text style={{ color: colors.text }} numberOfLines={1}>
                {c.displayName}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <Text style={{ color: '#b91c1c', marginTop: 8 }}>{error}</Text> : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={products}
        keyExtractor={(it) => it.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
        ListHeaderComponent={header}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} size="large" color={colors.primary} />
          ) : (
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', padding: 24 }]}>
              No products match your filters.
            </Text>
          )
        }
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
      {showNudge ? (
        <FinishSetupBanner onContinue={() => router.push('/onboarding')} onDismiss={dismiss} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  search: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
    paddingBottom: 4,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    maxWidth: 200,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
  },
  cardImageWrap: { position: 'relative', borderRadius: 8, overflow: 'hidden' },
  cardImage: { width: '100%', aspectRatio: 1, backgroundColor: '#e5e7eb' },
  outOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outText: { color: '#fff', fontWeight: '700' },
  compatBadge: { fontSize: 11, fontWeight: '600', marginTop: 4 },
});
