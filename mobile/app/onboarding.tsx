import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/ui/Button';
import api from '../services/api';
import { clearSetupSkippedFlag, setSetupSkippedFlag } from '../lib/setupSkippedStorage';
import { getWelcomeSeenFlag } from '../lib/welcomeSeenStorage';
import { labelForSanitationOption } from '../constants/sanitizationSystems';

type ScdbBrand = { id: string; name: string };
type SpaModelHit = {
  id: string;
  name: string;
  year: number;
  brandId: string;
  brandName?: string;
  modelLineName?: string;
};

type OnboardingStepId = 'brand' | 'modelPick' | 'sanitizer';

const SEASON_PRESETS: { key: string; label: string; months: number[] }[] = [
  { key: 'spring', label: 'Spring', months: [3, 4, 5] },
  { key: 'summer', label: 'Summer', months: [6, 7, 8] },
  { key: 'autumn', label: 'Autumn', months: [9, 10, 11] },
  { key: 'winter', label: 'Winter', months: [12, 1, 2] },
];

const ALL_USAGE_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const MONTH_LABELS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function stepEnabled(
  steps: { id: OnboardingStepId; enabled: boolean }[] | undefined,
  id: OnboardingStepId
): boolean {
  return steps?.find((s) => s.id === id)?.enabled !== false;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const insets = useSafeAreaInsets();
  const { config, loading: tenantLoading } = useTenant();
  const { colors } = useTheme();

  const onboarding = config?.onboarding;
  const showBrand = stepEnabled(onboarding?.steps, 'brand');
  const showSanitizer = stepEnabled(onboarding?.steps, 'sanitizer');
  const allowSkip = onboarding?.allowSkip !== false;

  const [brands, setBrands] = useState<ScdbBrand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<ScdbBrand | null>(null);
  const [brandModal, setBrandModal] = useState(false);

  const [modelQuery, setModelQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHits, setSearchHits] = useState<SpaModelHit[]>([]);
  const [modelModal, setModelModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<SpaModelHit | null>(null);

  const [sanitizerModal, setSanitizerModal] = useState(false);
  const [sanitizer, setSanitizer] = useState<string | null>(null);

  /** Custom / “not listed” paths → POST consumer-uhtd-suggestions (review queue only, no SCdb). */
  const [useCustomBrand, setUseCustomBrand] = useState(false);
  const [customBrandName, setCustomBrandName] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [customModelName, setCustomModelName] = useState('');
  const [customModelYear, setCustomModelYear] = useState('');
  const [customModelLine, setCustomModelLine] = useState('');
  const [useCustomSanitizer, setUseCustomSanitizer] = useState(false);
  const [customSanitizerNote, setCustomSanitizerNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareWaterTestsWithRetailer, setShareWaterTestsWithRetailer] = useState(true);

  const [usageMonths, setUsageMonths] = useState<number[]>(() => [...ALL_USAGE_MONTHS]);
  const [winterStrategy, setWinterStrategy] = useState<'shutdown' | 'operate'>('operate');

  const sanitizerOptions = useMemo(() => {
    const list = config?.sanitationSystemOptions ?? [];
    return list.length > 0
      ? list
      : [
          { value: 'bromine', displayName: 'Bromine' },
          { value: 'chlorine', displayName: 'Chlorine' },
          { value: 'frog_ease', displayName: 'Frog @Ease' },
          { value: 'copper', displayName: 'Copper' },
          { value: 'silver_mineral', displayName: 'Silver / Mineral stick' },
        ];
  }, [config?.sanitationSystemOptions]);

  useEffect(() => {
    if (!showBrand) return;
    let cancelled = false;
    (async () => {
      setBrandsLoading(true);
      try {
        const res = (await api.get('/scdb/brands')) as { data?: ScdbBrand[] };
        const list = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) setBrands(list);
      } catch {
        if (!cancelled) setBrands([]);
      } finally {
        if (!cancelled) setBrandsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showBrand]);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setSearchHits([]);
        return;
      }
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({ q: trimmed, limit: '40' });
        if (showBrand && selectedBrand?.id) {
          params.set('brandId', selectedBrand.id);
        }
        const res = (await api.get(`/scdb/search?${params.toString()}`)) as { data?: SpaModelHit[] };
        const list = Array.isArray(res.data) ? res.data : [];
        setSearchHits(list);
      } catch {
        setSearchHits([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [showBrand, selectedBrand?.id]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (modelModal) runSearch(modelQuery);
    }, 300);
    return () => clearTimeout(t);
  }, [modelQuery, modelModal, runSearch]);

  useEffect(() => {
    if (!showSanitizer && sanitizerOptions.length > 0 && !useCustomSanitizer) {
      setSanitizer(sanitizerOptions[0].value);
    }
  }, [showSanitizer, sanitizerOptions, useCustomSanitizer]);

  const brandOk =
    !showBrand && !useCustomModel
      ? true
      : !showBrand && useCustomModel
        ? customBrandName.trim().length >= 2
        : showBrand && useCustomBrand
          ? customBrandName.trim().length >= 2
          : showBrand
            ? !!selectedBrand
            : true;

  const modelOk = useCustomModel
    ? customModelName.trim().length >= 1
    : !!selectedModel;

  const sanitizerOk = !showSanitizer
    ? true
    : useCustomSanitizer
      ? customSanitizerNote.trim().length >= 2
      : !!sanitizer;

  const canSubmit = modelOk && sanitizerOk && brandOk && !submitting;

  const toggleMonth = (m: number) => {
    setUsageMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)
    );
  };

  const toggleSeasonMonths = (months: number[]) => {
    setUsageMonths((prev) => {
      const allSelected = months.every((x) => prev.includes(x));
      if (allSelected) {
        return prev.filter((x) => !months.includes(x)).sort((a, b) => a - b);
      }
      return [...new Set([...prev, ...months])].sort((a, b) => a - b);
    });
  };

  function payloadUsageMonthsForCreate(): number[] | undefined {
    if (usageMonths.length === 0) return [...ALL_USAGE_MONTHS];
    const fullYear =
      usageMonths.length === 12 && ALL_USAGE_MONTHS.every((m) => usageMonths.includes(m));
    if (fullYear) return undefined;
    return usageMonths;
  }

  /** Free-text fields the customer entered (shown in Super Admin review queue as typed). */
  function buildCustomerEnteredForQueue(): { brand?: string; model?: string; modelLine?: string } | undefined {
    const out: { brand?: string; model?: string; modelLine?: string } = {};
    if (useCustomBrand && customBrandName.trim()) {
      out.brand = customBrandName.trim();
    }
    if (useCustomModel) {
      if (customModelName.trim()) out.model = customModelName.trim();
      if (customModelLine.trim()) out.modelLine = customModelLine.trim();
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  const screenBg = '#F2F4F8';
  const cardBg = '#FFFFFF';
  const inputWell = '#EEF1F5';

  async function handleSubmit() {
    setError(null);
    if (!modelOk || !sanitizerOk || !brandOk) {
      setError('Fill in make, model, and sanitation system to continue.');
      return;
    }
    setSubmitting(true);
    try {
      const needsQueue = useCustomBrand || useCustomModel || useCustomSanitizer;

      if (needsQueue) {
        let brandId: string | null = null;
        let brandName: string | undefined;
        if (showBrand) {
          if (useCustomBrand) brandName = customBrandName.trim();
          else brandId = selectedBrand!.id;
        } else if (useCustomModel) {
          brandName = customBrandName.trim();
        } else {
          brandId = selectedModel!.brandId;
        }

        const yearParsed = useCustomModel
          ? parseInt(customModelYear.replace(/\D/g, ''), 10)
          : undefined;
        const year = useCustomModel
          ? Number.isFinite(yearParsed) && (yearParsed as number) > 0
            ? (yearParsed as number)
            : 0
          : selectedModel!.year;

        await api.post('/consumer-uhtd-suggestions', {
          brandId,
          brandName: brandId ? undefined : brandName,
          modelLineName: useCustomModel ? customModelLine.trim() || null : null,
          modelName: useCustomModel ? customModelName.trim() : selectedModel!.name,
          year,
          sanitizationSystem: useCustomSanitizer ? 'other' : sanitizer!,
          customSanitizerNote: useCustomSanitizer ? customSanitizerNote.trim() : undefined,
          usageMonths: payloadUsageMonthsForCreate(),
          winterStrategy,
          customerEntered: buildCustomerEnteredForQueue(),
        });
      } else {
        await api.post('/spa-profiles', {
          uhtdSpaModelId: selectedModel!.id,
          sanitizationSystem: sanitizer!,
          usageMonths: payloadUsageMonthsForCreate(),
          winterStrategy,
        });
      }
      await clearSetupSkippedFlag();
      if (shareWaterTestsWithRetailer) {
        try {
          await api.put('/users/me', { shareWaterTestsWithRetailer: true });
        } catch {
          // Non-fatal; user can enable in Profile later
        }
      }
      if (returnTo === 'profile') {
        router.replace('/(tabs)/profile');
      } else {
        const welcomeSeen = await getWelcomeSeenFlag();
        if (welcomeSeen) {
          router.replace('/(tabs)/home');
        } else {
          const modelDisplayName =
            selectedModel?.name ?? customModelName?.trim() ?? 'your spa';
          router.replace(`/welcome?modelName=${encodeURIComponent(modelDisplayName)}`);
        }
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : 'Could not save your profile';
      setError(msg ?? 'Could not save your profile');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    await setSetupSkippedFlag(true);
    router.replace(returnTo === 'profile' ? '/(tabs)/profile' : '/(tabs)/home');
  }

  if (tenantLoading || !config) {
    return (
      <View style={[styles.center, { backgroundColor: screenBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: screenBg, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <View style={styles.header}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            {config.branding.iconUrl ? (
              <Image source={{ uri: config.branding.iconUrl }} style={styles.logoImg} resizeMode="contain" />
            ) : (
              <Text style={styles.logoFallback}>HT</Text>
            )}
          </View>
          <Text style={styles.retailerName}>{config.name}</Text>
          <Text style={[styles.appSubtitle, { color: colors.primary }]}>Hot Tub Companion App</Text>
          <Text style={styles.helper}>Let&apos;s get started by setting up your hot tub profile</Text>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          {error ? <Text style={styles.formError}>{error}</Text> : null}

          {showBrand ? (
            <View style={styles.field}>
              <Text style={styles.label}>Hot Tub Make</Text>
              {useCustomBrand ? (
                <>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: inputWell, borderColor: inputWell }]}
                    placeholder="Enter your make"
                    placeholderTextColor="#888"
                    value={customBrandName}
                    onChangeText={setCustomBrandName}
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setUseCustomBrand(false);
                      setCustomBrandName('');
                    }}
                    style={styles.notListedLink}
                  >
                    <Text style={[styles.notListedText, { color: colors.primary }]}>
                      Choose from list instead
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.inputWell, { backgroundColor: inputWell }]}
                    onPress={() => setBrandModal(true)}
                    accessibilityRole="button"
                  >
                    <Text style={selectedBrand ? styles.inputText : styles.placeholder}>
                      {selectedBrand ? selectedBrand.name : 'Select make'}
                    </Text>
                    <Text style={styles.chevron}>v</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedBrand(null);
                      setSelectedModel(null);
                      setUseCustomBrand(true);
                    }}
                    style={styles.notListedLink}
                  >
                    <Text style={[styles.notListedText, { color: colors.primary }]}>Not listed?</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Model</Text>
            {useCustomModel ? (
              <>
                {!showBrand ? (
                  <TextInput
                    style={[styles.textInput, { backgroundColor: inputWell, borderColor: inputWell, marginBottom: 10 }]}
                    placeholder="Hot tub make (required)"
                    placeholderTextColor="#888"
                    value={customBrandName}
                    onChangeText={setCustomBrandName}
                    autoCorrect={false}
                  />
                ) : null}
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputWell, borderColor: inputWell, marginBottom: 10 }]}
                  placeholder="Model name or series"
                  placeholderTextColor="#888"
                  value={customModelName}
                  onChangeText={setCustomModelName}
                  autoCorrect={false}
                />
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputWell, borderColor: inputWell, marginBottom: 10 }]}
                  placeholder="Year (optional)"
                  placeholderTextColor="#888"
                  value={customModelYear}
                  onChangeText={setCustomModelYear}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputWell, borderColor: inputWell, marginBottom: 10 }]}
                  placeholder="Model line / collection (optional)"
                  placeholderTextColor="#888"
                  value={customModelLine}
                  onChangeText={setCustomModelLine}
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => {
                    setUseCustomModel(false);
                    setCustomModelName('');
                    setCustomModelYear('');
                    setCustomModelLine('');
                    if (!showBrand) setCustomBrandName('');
                  }}
                  style={styles.notListedLink}
                >
                  <Text style={[styles.notListedText, { color: colors.primary }]}>
                    Search catalog instead
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.inputWell, { backgroundColor: inputWell }]}
                  onPress={() => {
                    if (showBrand && !selectedBrand && !useCustomBrand) {
                      setError('Select a make first.');
                      return;
                    }
                    setError(null);
                    setModelModal(true);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={selectedModel ? styles.inputText : styles.placeholder} numberOfLines={1}>
                    {selectedModel
                      ? `${selectedModel.name} (${selectedModel.year})`
                      : 'Search and select your model'}
                  </Text>
                  <Text style={styles.chevron}>v</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedModel(null);
                    setUseCustomModel(true);
                  }}
                  style={styles.notListedLink}
                >
                  <Text style={[styles.notListedText, { color: colors.primary }]}>Not listed?</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Year</Text>
            <View style={[styles.inputWell, { backgroundColor: inputWell, opacity: useCustomModel || selectedModel ? 1 : 0.6 }]}>
              <Text style={useCustomModel || selectedModel ? styles.inputText : styles.placeholder}>
                {useCustomModel
                  ? customModelYear.trim()
                    ? customModelYear.trim()
                    : 'Not sure (we will verify)'
                  : selectedModel
                    ? String(selectedModel.year)
                    : 'Select model first'}
              </Text>
            </View>
          </View>

          {showSanitizer ? (
            <View style={styles.field}>
              <Text style={styles.label}>Sanitation System</Text>
              {useCustomSanitizer ? (
                <>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: inputWell, borderColor: inputWell, minHeight: 80 }]}
                    placeholder="Describe your sanitation system"
                    placeholderTextColor="#888"
                    value={customSanitizerNote}
                    onChangeText={setCustomSanitizerNote}
                    multiline
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setUseCustomSanitizer(false);
                      setCustomSanitizerNote('');
                    }}
                    style={styles.notListedLink}
                  >
                    <Text style={[styles.notListedText, { color: colors.primary }]}>
                      Choose from list instead
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.inputWell, { backgroundColor: inputWell }]}
                    onPress={() => setSanitizerModal(true)}
                    accessibilityRole="button"
                  >
                    <Text style={sanitizer ? styles.inputText : styles.placeholder}>
                      {sanitizer ? labelForSanitationOption(sanitizer, sanitizerOptions) : 'Select sanitation system'}
                    </Text>
                    <Text style={styles.chevron}>v</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setUseCustomSanitizer(true);
                      setSanitizer('other');
                    }}
                    style={styles.notListedLink}
                  >
                    <Text style={[styles.notListedText, { color: colors.primary }]}>Not listed?</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>What months do you use your spa?</Text>
            <Text style={styles.helperSmall}>
              Tap a season preset or turn off months you do not use so your care schedule matches how you actually
              use the tub.
            </Text>
            <View style={styles.seasonRow}>
              {SEASON_PRESETS.map((s) => {
                const active = s.months.every((m) => usageMonths.includes(m));
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.seasonChip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => toggleSeasonMonths(s.months)}
                  >
                    <Text style={[styles.seasonChipText, { color: active ? '#fff' : '#333' }]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.monthsRow}>
              {ALL_USAGE_MONTHS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.monthBtn,
                    usageMonths.includes(m) && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => toggleMonth(m)}
                >
                  <Text style={[styles.monthBtnText, { color: usageMonths.includes(m) ? '#fff' : '#333' }]}>
                    {MONTH_LABELS_SHORT[m - 1]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>When you are not using the tub</Text>
            <Text style={styles.helperSmall}>
              Shutdown adds winterize and spring startup reminders when you have off-months.
            </Text>
            <TouchableOpacity
              style={[
                styles.strategyRow,
                winterStrategy === 'shutdown' && { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
              ]}
              onPress={() => setWinterStrategy('shutdown')}
            >
              <Text style={styles.strategyTitle}>Shut down when not in use</Text>
              <Text style={styles.strategySub}>Winterize during off months</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.strategyRow,
                winterStrategy === 'operate' && { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
              ]}
              onPress={() => setWinterStrategy('operate')}
            >
              <Text style={styles.strategyTitle}>Keep running year-round</Text>
              <Text style={styles.strategySub}>No full winterize / startup pair</Text>
            </TouchableOpacity>
          </View>

          {useCustomBrand || useCustomModel || useCustomSanitizer ? (
            <Text style={styles.queueHint}>
              Your details will be sent for review. Nothing is added to the master catalog until our team
              verifies your hot tub.
            </Text>
          ) : null}

          <View style={[styles.field, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }]}>
            <Text style={[styles.label, { flex: 1, marginBottom: 0 }]}>
              Share water test data with {config?.name ?? 'your retailer'}?
            </Text>
            <Switch
              value={shareWaterTestsWithRetailer}
              onValueChange={setShareWaterTestsWithRetailer}
              trackColor={{ false: '#ccc', true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
          <Text style={[styles.queueHint, { marginTop: 4 }]}>
            When enabled, your retailer can view water test results to help with recommendations.
          </Text>

          <View style={styles.ctaWrap}>
            <Button title={submitting ? 'Saving...' : 'Get Started'} onPress={handleSubmit} disabled={!canSubmit} />
          </View>
        </View>

        {allowSkip ? (
          <TouchableOpacity onPress={handleSkip} style={styles.skipWrap} accessibilityRole="button">
            <Text style={[styles.skip, { color: colors.textSecondary }]}>Skip for now</Text>
          </TouchableOpacity>
        ) : null}
        {__DEV__ ? (
          <TouchableOpacity
            onPress={() => router.replace('/welcome?modelName=Test+Spa')}
            style={[styles.skipWrap, { marginTop: 8 }]}
            accessibilityRole="button"
          >
            <Text style={[styles.skip, { color: colors.primary, fontSize: 13 }]}>
              [Dev] Test Welcome Screen
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={brandModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select make</Text>
            {brandsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <FlatList
                data={brands}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalRow}
                    onPress={() => {
                      setUseCustomBrand(false);
                      setCustomBrandName('');
                      setSelectedBrand(item);
                      setSelectedModel(null);
                      setBrandModal(false);
                    }}
                  >
                    <Text style={styles.modalRowText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.placeholder}>No brands available.</Text>}
                ListFooterComponent={
                  <TouchableOpacity
                    style={styles.modalRow}
                    onPress={() => {
                      setSelectedBrand(null);
                      setSelectedModel(null);
                      setUseCustomBrand(true);
                      setBrandModal(false);
                    }}
                  >
                    <Text style={[styles.modalRowText, { color: colors.primary, fontWeight: '600' }]}>
                      Not listed? Enter your make on the form
                    </Text>
                  </TouchableOpacity>
                }
              />
            )}
            <TouchableOpacity onPress={() => setBrandModal(false)} style={styles.modalClose}>
              <Text style={{ color: colors.primary }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modelModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Find your model</Text>
            <TextInput
              style={[styles.searchInput, { borderColor: inputWell, backgroundColor: inputWell }]}
              placeholder="Type model name..."
              placeholderTextColor="#888"
              value={modelQuery}
              onChangeText={setModelQuery}
              autoCorrect={false}
            />
            {searchLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} /> : null}
            <FlatList
              data={searchHits}
              keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => {
                    setUseCustomModel(false);
                    setCustomModelName('');
                    setCustomModelYear('');
                    setCustomModelLine('');
                    setSelectedModel(item);
                    setModelModal(false);
                    setModelQuery('');
                  }}
                >
                  <Text style={styles.modalRowText}>
                    {item.brandName} {item.name} ({item.year})
                  </Text>
                  {item.modelLineName ? (
                    <Text style={styles.modalSub}>{item.modelLineName}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                modelQuery.trim().length < 2 ? (
                  <Text style={styles.placeholder}>Type at least 2 characters.</Text>
                ) : (
                  <Text style={styles.placeholder}>No matches.</Text>
                )
              }
              ListFooterComponent={
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => {
                    setSelectedModel(null);
                    setUseCustomModel(true);
                    setModelModal(false);
                    setModelQuery('');
                  }}
                >
                  <Text style={[styles.modalRowText, { color: colors.primary, fontWeight: '600' }]}>
                    Not listed? Enter your model on the form
                  </Text>
                </TouchableOpacity>
              }
            />
            <TouchableOpacity onPress={() => setModelModal(false)} style={styles.modalClose}>
              <Text style={{ color: colors.primary }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={sanitizerModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sanitation system</Text>
            <FlatList
              data={sanitizerOptions}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => {
                    setUseCustomSanitizer(false);
                    setCustomSanitizerNote('');
                    setSanitizer(item.value);
                    setSanitizerModal(false);
                  }}
                >
                  <Text style={styles.modalRowText}>{item.displayName}</Text>
                </TouchableOpacity>
              )}
              ListFooterComponent={
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => {
                    setUseCustomSanitizer(true);
                    setSanitizer('other');
                    setSanitizerModal(false);
                  }}
                >
                  <Text style={[styles.modalRowText, { color: colors.primary, fontWeight: '600' }]}>
                    Not listed? Describe on the form
                  </Text>
                </TouchableOpacity>
              }
            />
            <TouchableOpacity onPress={() => setSanitizerModal(false)} style={styles.modalClose}>
              <Text style={{ color: colors.primary }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoImg: { width: 44, height: 44 },
  logoFallback: { color: '#fff', fontWeight: '800', fontSize: 22 },
  retailerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  helper: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    lineHeight: 20,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  field: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 8,
  },
  inputWell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inputText: { fontSize: 15, color: '#222', flex: 1 },
  placeholder: { fontSize: 15, color: '#888', flex: 1 },
  chevron: { fontSize: 12, color: '#888', marginLeft: 8 },
  ctaWrap: { marginTop: 8 },
  skipWrap: { alignItems: 'center', marginTop: 20 },
  skip: { fontSize: 14, fontWeight: '500' },
  formError: { color: '#dc2626', marginBottom: 12, fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  modalRowText: { fontSize: 16, color: '#111' },
  modalSub: { fontSize: 13, color: '#666', marginTop: 2 },
  modalClose: { alignItems: 'center', paddingVertical: 16 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#222',
  },
  notListedLink: {
    marginTop: 8,
    paddingVertical: 4,
  },
  notListedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  queueHint: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
    marginBottom: 8,
  },
  helperSmall: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
    marginBottom: 10,
  },
  seasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  seasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  seasonChipText: { fontSize: 14, fontWeight: '600' },
  monthsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthBtn: {
    minWidth: 48,
    paddingHorizontal: 8,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnText: { fontSize: 11, fontWeight: '600' },
  strategyRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  strategyTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 },
  strategySub: { fontSize: 13, color: '#64748b', lineHeight: 18 },
});
