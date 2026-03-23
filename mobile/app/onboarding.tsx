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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/ui/Button';
import api from '../services/api';
import { clearSetupSkippedFlag, setSetupSkippedFlag } from '../lib/setupSkippedStorage';
import { labelForSanitizer } from '../constants/sanitizationSystems';

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

function stepEnabled(
  steps: { id: OnboardingStepId; enabled: boolean }[] | undefined,
  id: OnboardingStepId
): boolean {
  return steps?.find((s) => s.id === id)?.enabled !== false;
}

export default function OnboardingScreen() {
  const router = useRouter();
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

  const sanitizerOptions = useMemo(() => {
    const list = config?.sanitizationSystems ?? [];
    return list.length > 0 ? list : ['bromine', 'chlorine', 'frog_ease', 'copper', 'silver_mineral'];
  }, [config?.sanitizationSystems]);

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
      setSanitizer(sanitizerOptions[0]);
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

  const screenBg = '#F2F4F8';
  const cardBg = '#FFFFFF';
  const inputWell = '#EEF1F5';

  async function handleSubmit() {
    setError(null);
    if (!modelOk || !sanitizerOk || !brandOk) {
      setError('Fill in make, model, and sanitizer to continue.');
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
        });
      } else {
        await api.post('/spa-profiles', {
          uhtdSpaModelId: selectedModel!.id,
          sanitizationSystem: sanitizer!,
        });
      }
      await clearSetupSkippedFlag();
      router.replace('/(tabs)/home');
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
    router.replace('/(tabs)/home');
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
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
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
              <Text style={styles.label}>Sanitizer System</Text>
              {useCustomSanitizer ? (
                <>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: inputWell, borderColor: inputWell, minHeight: 80 }]}
                    placeholder="Describe your sanitizer system"
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
                      {sanitizer ? labelForSanitizer(sanitizer) : 'Select sanitizer'}
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

          {useCustomBrand || useCustomModel || useCustomSanitizer ? (
            <Text style={styles.queueHint}>
              Your details will be sent for review. Nothing is added to the master catalog until our team
              verifies your hot tub.
            </Text>
          ) : null}

          <View style={styles.ctaWrap}>
            <Button title={submitting ? 'Saving...' : 'Get Started'} onPress={handleSubmit} disabled={!canSubmit} />
          </View>
        </View>

        {allowSkip ? (
          <TouchableOpacity onPress={handleSkip} style={styles.skipWrap} accessibilityRole="button">
            <Text style={[styles.skip, { color: colors.textSecondary }]}>Skip for now</Text>
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
            <Text style={styles.modalTitle}>Sanitizer system</Text>
            <FlatList
              data={sanitizerOptions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => {
                    setUseCustomSanitizer(false);
                    setCustomSanitizerNote('');
                    setSanitizer(item);
                    setSanitizerModal(false);
                  }}
                >
                  <Text style={styles.modalRowText}>{labelForSanitizer(item)}</Text>
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
});
