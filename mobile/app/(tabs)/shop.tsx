import { Ionicons } from '@expo/vector-icons';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
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
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeroHeader } from '../../components/AppHeroHeader';
import { FinishSetupBanner } from '../../components/FinishSetupBanner';
import { StatusBarBar } from '../../components/StatusBarBar';
import { useFinishSetupNudge } from '../../hooks/useFinishSetupNudge';
import { formatProductPriceCents } from '../../lib/formatProductPrice';
import { useTheme } from '../../theme/ThemeProvider';
import api from '../../services/api';
import {
  categoryKeyForProductType,
  categoryKeyForUhtdCategory,
  fetchShopCategories,
  fetchShopPriceBounds,
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

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

const PAGE_SIZE = 20;
const { width: SCREEN_W } = Dimensions.get('window');
/** Horizontal inset so thumbs are not flush with the panel edge. */
const SLIDER_SIDE_GUTTER = 22;

const DEFAULT_APPLIED = {
  includeOtherSpaParts: false,
  includeGeneralStore: true,
  hideOutOfStock: true,
  priceMinCents: undefined as number | undefined,
  priceMaxCents: undefined as number | undefined,
  categoryKey: null as string | null,
};

export default function Shop() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productId?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { totalQuantity, refreshCart } = useCart();
  const { colors, typography, spacing } = useTheme();
  const { showNudge, dismiss } = useFinishSetupNudge();
  const primaryHex = colors.primary ?? '#1B4D7A';
  const scrollY = useRef(new Animated.Value(0)).current;

  const redirectedRef = useRef(false);
  useEffect(() => {
    const pid = typeof params.productId === 'string' ? params.productId : undefined;
    if (pid && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace(`/(tabs)/shop/${pid}` as Href);
    }
  }, [params.productId, router]);

  const [spaProfileId, setSpaProfileId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [products, setProducts] = useState<ShopProductRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [applied, setApplied] = useState({ ...DEFAULT_APPLIED });
  const [filterOpen, setFilterOpen] = useState(false);
  const [priceBounds, setPriceBounds] = useState<{ min: number; max: number } | null>(null);
  const [boundsLoading, setBoundsLoading] = useState(false);
  /** Slider thumbs (updates while dragging; price commits on release). */
  const [sliderValues, setSliderValues] = useState<[number, number]>([0, 0]);
  const [sliderTrackWidth, setSliderTrackWidth] = useState(280);
  /** Disable filter sheet scroll while dragging price so the list does not steal the gesture. */
  const [priceSliderDragging, setPriceSliderDragging] = useState(false);
  /** First bounds response after opening the panel: preserve/clamp existing price filter. */
  const priceInitPendingRef = useRef(false);
  const boundsGenerationRef = useRef(0);
  const appliedRef = useRef(applied);
  appliedRef.current = applied;

  const panelX = useRef(new Animated.Value(SCREEN_W)).current;

  useFocusEffect(
    useCallback(() => {
      void refreshCart();
    }, [refreshCart])
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 320);
    return () => clearTimeout(t);
  }, [search]);

  const openFilters = useCallback(() => {
    priceInitPendingRef.current = true;
    setPriceSliderDragging(false);
    setPriceBounds(null);
    setSliderValues([0, 0]);
    panelX.setValue(SCREEN_W);
    setFilterOpen(true);
    requestAnimationFrame(() => {
      Animated.spring(panelX, { toValue: 0, useNativeDriver: true, friction: 9 }).start();
    });
  }, [panelX]);

  const closeFilters = useCallback(() => {
    priceInitPendingRef.current = false;
    setPriceSliderDragging(false);
    Animated.timing(panelX, { toValue: SCREEN_W, duration: 220, useNativeDriver: true }).start(() =>
      setFilterOpen(false)
    );
  }, [panelX]);

  useEffect(() => {
    if (!filterOpen) return;
    const gen = ++boundsGenerationRef.current;
    let cancelled = false;
    setBoundsLoading(true);
    (async () => {
      try {
        const res = await fetchShopPriceBounds({
          spaProfileId,
          includeOtherSpaParts: applied.includeOtherSpaParts,
          includeGeneralStore: applied.includeGeneralStore,
          hideOutOfStock: applied.hideOutOfStock,
          categoryKey: applied.categoryKey,
          search: debouncedSearch,
        });
        if (cancelled || gen !== boundsGenerationRef.current) return;
        const minRaw = res.data?.minCents;
        const maxRaw = res.data?.maxCents;
        if (minRaw == null || maxRaw == null) {
          setPriceBounds(null);
          setSliderValues([0, 0]);
          priceInitPendingRef.current = false;
          return;
        }
        const lo = Math.min(minRaw, maxRaw);
        const hi = Math.max(minRaw, maxRaw);
        setPriceBounds({ min: lo, max: hi });

        const appliedSnap = appliedRef.current;
        const initFromOpen = priceInitPendingRef.current;
        if (initFromOpen) {
          priceInitPendingRef.current = false;
          let low: number;
          let high: number;
          if (lo === hi) {
            low = lo;
            high = hi;
          } else if (appliedSnap.priceMinCents == null && appliedSnap.priceMaxCents == null) {
            low = lo;
            high = hi;
          } else {
            const a = clamp(appliedSnap.priceMinCents ?? lo, lo, hi);
            const b = clamp(appliedSnap.priceMaxCents ?? hi, lo, hi);
            low = Math.min(a, b);
            high = Math.max(a, b);
          }
          setSliderValues([low, high]);
          const coversAll = lo < hi && low <= lo && high >= hi;
          const clearPrice = lo === hi || coversAll;
          setApplied((prev) => ({
            ...prev,
            priceMinCents: clearPrice ? undefined : low,
            priceMaxCents: clearPrice ? undefined : high,
          }));
        } else {
          setSliderValues([lo, hi]);
          setApplied((prev) => ({
            ...prev,
            priceMinCents: undefined,
            priceMaxCents: undefined,
          }));
        }
      } catch {
        if (!cancelled && gen === boundsGenerationRef.current) {
          setPriceBounds(null);
          setSliderValues([0, 0]);
          priceInitPendingRef.current = false;
        }
      } finally {
        if (!cancelled && gen === boundsGenerationRef.current) setBoundsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    filterOpen,
    spaProfileId,
    applied.includeOtherSpaParts,
    applied.includeGeneralStore,
    applied.hideOutOfStock,
    applied.categoryKey,
    debouncedSearch,
  ]);

  const commitPriceFromSlider = useCallback(
    (vals: number[]) => {
      if (!priceBounds) return;
      const { min, max } = priceBounds;
      const low = Math.min(vals[0] ?? min, vals[1] ?? max);
      const high = Math.max(vals[0] ?? min, vals[1] ?? max);
      const coversAll = low <= min && high >= max;
      setApplied((prev) => ({
        ...prev,
        priceMinCents: coversAll ? undefined : low,
        priceMaxCents: coversAll ? undefined : high,
      }));
    },
    [priceBounds]
  );

  const onPriceSliderFinish = useCallback(
    (vals: number[]) => {
      setPriceSliderDragging(false);
      commitPriceFromSlider(vals);
    },
    [commitPriceFromSlider]
  );

  const clearAllFilters = useCallback(() => {
    setApplied({ ...DEFAULT_APPLIED });
    setSliderValues([0, 0]);
    closeFilters();
  }, [closeFilters]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchShopCategories({
          spaProfileId,
          includeOtherSpaParts: applied.includeOtherSpaParts,
          includeGeneralStore: applied.includeGeneralStore,
          hideOutOfStock: applied.hideOutOfStock,
          priceMin: applied.priceMinCents,
          priceMax: applied.priceMaxCents,
        });
        if (!cancelled) setCategories(res.data ?? []);
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    spaProfileId,
    applied.includeOtherSpaParts,
    applied.includeGeneralStore,
    applied.hideOutOfStock,
    applied.priceMinCents,
    applied.priceMaxCents,
  ]);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      setError(null);
      try {
        const res = await fetchShopProducts({
          spaProfileId,
          includeOtherSpaParts: applied.includeOtherSpaParts,
          includeGeneralStore: applied.includeGeneralStore,
          hideOutOfStock: applied.hideOutOfStock,
          priceMin: applied.priceMinCents,
          priceMax: applied.priceMaxCents,
          page: pageNum,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
          categoryKey: applied.categoryKey,
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
    [spaProfileId, applied, debouncedSearch]
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
          {formatProductPriceCents(item.price)}
        </Text>
      </Pressable>
    );
  };

  const cartHeaderButton = useMemo(
    () => (
      <Pressable
        onPress={() => router.push('/(tabs)/shop/cart')}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        accessibilityLabel="Open cart"
      >
        <View style={{ position: 'relative' }}>
          <Ionicons name="bag-outline" size={28} color="#fff" />
          {user && totalQuantity > 0 ? (
            <View
              style={{
                position: 'absolute',
                right: -6,
                top: -4,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#f97316',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                {totalQuantity > 99 ? '99+' : totalQuantity}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    ),
    [router, user, totalQuantity]
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeaderWrap}>
        <AppHeroHeader
          icon="cart-outline"
          title="Shop"
          subtitle="Browse products"
          trailing={cartHeaderButton}
        />
        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search title or description"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.search,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface, flex: 1 },
            ]}
          />
          <Pressable
            onPress={openFilters}
            style={({ pressed }) => [
              styles.filterBtn,
              { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.88 : 1 },
            ]}
            accessibilityLabel="Open filters"
          >
            <Ionicons name="menu-outline" size={26} color={colors.primary} />
          </Pressable>
        </View>
        {error ? <Text style={{ color: '#b91c1c', marginTop: 8 }}>{error}</Text> : null}
      </View>
    ),
    [search, colors, openFilters, error, cartHeaderButton]
  );

  const priceBoundsSingle = priceBounds != null && priceBounds.min === priceBounds.max;
  const canShowSlider = priceBounds != null && priceBounds.min < priceBounds.max;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBarBar primaryColor={primaryHex} scrollY={scrollY} />
      <Animated.FlatList
        style={styles.scroll}
        data={products}
        keyExtractor={(it) => it.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
        ListHeaderComponent={listHeader}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} /> : null}
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
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

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
                scrollEnabled={!priceSliderDragging}
                nestedScrollEnabled
              >
                <Text style={[styles.filterSectionLabel, { color: colors.textMuted }]}>Compatibility</Text>
                <View style={styles.toggleRow}>
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Include parts for other spa models</Text>
                  <Switch
                    value={applied.includeOtherSpaParts}
                    onValueChange={(v) => setApplied((prev) => ({ ...prev, includeOtherSpaParts: v }))}
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Include general store products</Text>
                  <Switch
                    value={applied.includeGeneralStore}
                    onValueChange={(v) => setApplied((prev) => ({ ...prev, includeGeneralStore: v }))}
                  />
                </View>

                <Text style={[styles.filterSectionLabel, { color: colors.textMuted, marginTop: 8 }]}>Inventory</Text>
                <View style={styles.toggleRow}>
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Hide out of stock</Text>
                  <Switch
                    value={applied.hideOutOfStock}
                    onValueChange={(v) => setApplied((prev) => ({ ...prev, hideOutOfStock: v }))}
                  />
                </View>

                <Text style={[styles.filterSectionLabel, { color: colors.textMuted, marginTop: 8 }]}>Price</Text>
                {boundsLoading ? (
                  <ActivityIndicator style={{ marginBottom: 16 }} color={colors.primary} />
                ) : priceBoundsSingle && priceBounds ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[typography.body, { color: colors.textSecondary }]}>
                      All matches are{' '}
                      <Text style={{ fontWeight: '700', color: colors.text }}>{formatProductPriceCents(priceBounds.min)}</Text>
                      .
                    </Text>
                  </View>
                ) : !canShowSlider ? (
                  <Text style={[typography.body, { color: colors.textSecondary, marginBottom: 16 }]}>
                    No priced products for this combination of filters.
                  </Text>
                ) : (
                  <View style={[styles.sliderBlock, { paddingHorizontal: SLIDER_SIDE_GUTTER }]}>
                    <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 10 }]}>
                      Available in this set:{' '}
                      <Text style={{ fontWeight: '600', color: colors.textSecondary }}>
                        {formatProductPriceCents(priceBounds.min)} — {formatProductPriceCents(priceBounds.max)}
                      </Text>
                    </Text>
                    <View
                      onLayout={(e) => {
                        const w = e.nativeEvent.layout.width;
                        if (w > 40) setSliderTrackWidth(Math.floor(w));
                      }}
                    >
                      <MultiSlider
                        key={`${priceBounds.min}-${priceBounds.max}`}
                        values={[sliderValues[0], sliderValues[1]]}
                        onValuesChangeStart={() => setPriceSliderDragging(true)}
                        onValuesChange={(vals) =>
                          setSliderValues([vals[0] ?? priceBounds.min, vals[1] ?? priceBounds.max])
                        }
                        onValuesChangeFinish={(vals) => onPriceSliderFinish(vals)}
                        min={priceBounds.min}
                        max={priceBounds.max}
                        step={1}
                        allowOverlap={false}
                        snapped
                        minMarkerOverlapDistance={12}
                        sliderLength={Math.max(160, sliderTrackWidth)}
                        markerOffsetY={1}
                        touchDimensions={{
                          height: 56,
                          width: 56,
                          borderRadius: 28,
                          slipDisplacement: 280,
                        }}
                        trackStyle={{
                          height: 8,
                          borderRadius: 4,
                        }}
                        selectedStyle={{
                          backgroundColor: colors.primary,
                          height: 8,
                          borderRadius: 4,
                        }}
                        unselectedStyle={{
                          backgroundColor: colors.border,
                          height: 8,
                          borderRadius: 4,
                        }}
                        markerStyle={{
                          height: 30,
                          width: 30,
                          borderRadius: 15,
                          backgroundColor: '#fff',
                          borderWidth: 2,
                          borderColor: colors.primary,
                        }}
                        pressedMarkerStyle={{
                          height: 32,
                          width: 32,
                          borderRadius: 16,
                          backgroundColor: '#fff',
                          borderWidth: 2,
                          borderColor: colors.primary,
                        }}
                        containerStyle={{ marginBottom: 4, height: 56, justifyContent: 'center' }}
                      />
                    </View>
                    <View
                      style={[
                        styles.priceRangeCallout,
                        {
                          backgroundColor: colors.primary + '14',
                          borderColor: colors.primary + '55',
                        },
                      ]}
                    >
                      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]}>
                        Selected range
                      </Text>
                      <Text
                        style={{
                          fontSize: 22,
                          fontWeight: '800',
                          color: colors.primary,
                          letterSpacing: -0.3,
                        }}
                      >
                        {formatProductPriceCents(Math.min(sliderValues[0], sliderValues[1]))}
                        <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 18 }}> — </Text>
                        {formatProductPriceCents(Math.max(sliderValues[0], sliderValues[1]))}
                      </Text>
                    </View>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>
                      Release handles to apply this price range to results.
                    </Text>
                  </View>
                )}

                <Text style={[styles.filterSectionLabel, { color: colors.textMuted, marginTop: 8 }]}>Category</Text>
                <View style={styles.categoryWrap}>
                  <Pressable
                    onPress={() => setApplied((prev) => ({ ...prev, categoryKey: null }))}
                    style={[
                      styles.pill,
                      {
                        borderColor: colors.border,
                        backgroundColor: applied.categoryKey === null ? colors.primary + '22' : colors.surface,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600' }}>All</Text>
                  </Pressable>
                  {categories.map((c) => {
                    const key = c.kind === 'uhtd' ? categoryKeyForUhtdCategory(c.id) : categoryKeyForProductType(c.key);
                    const sel = applied.categoryKey === key;
                    return (
                      <Pressable
                        key={`${c.kind}:${c.kind === 'uhtd' ? c.id : c.key}`}
                        onPress={() => setApplied((prev) => ({ ...prev, categoryKey: key }))}
                        style={[
                          styles.pill,
                          {
                            borderColor: colors.border,
                            backgroundColor: sel ? colors.primary + '22' : colors.surface,
                          },
                        ]}
                      >
                        <Text style={{ color: colors.text }} numberOfLines={2}>
                          {c.displayName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={[styles.filterFooter, { borderTopColor: colors.border }]}>
                <Pressable
                  onPress={clearAllFilters}
                  style={({ pressed }) => [
                    styles.footerBtnClear,
                    { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>Clear all filters</Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </View>
      </Modal>

      {showNudge ? <FinishSetupBanner onContinue={() => router.push('/onboarding')} onDismiss={dismiss} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  /** Match Water Care / Dealer scroll `content` so AppHeroHeader −24 margins align the gradient. */
  listContent: {
    flexGrow: 1,
    padding: 24,
  },
  listHeaderWrap: {
    paddingBottom: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 0,
  },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  filterBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  sliderBlock: {
    marginBottom: 8,
  },
  priceRangeCallout: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '100%',
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
