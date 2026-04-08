import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import api from '../../services/api';
import { AppPageHeader } from '../../components/AppPageHeader';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../theme/ThemeProvider';

type SpaProfile = {
  id: string;
  brand?: string | null;
  modelLine?: string | null;
  model?: string | null;
  year?: number | null;
  nickname?: string | null;
  isPrimary?: boolean;
};

type WaterTestKit = {
  id: string;
  title: string;
  imageUrl?: string | null;
  metrics: Array<{ metricKey: string; inputMode?: string; helpCopy?: string | null }>;
};

type WaterCareLegal = {
  policyVersion: string;
  acknowledgmentTitle: string;
  acknowledgmentBody: string;
  fullPolicyUrl: string | null;
};

type WaterCareTipsBlock = {
  testingTipsTitle: string;
  testingTips: Array<{ text: string }>;
  legal?: WaterCareLegal;
};

type Recommendation = {
  metricKey: string;
  status: string;
  suggestedChemical?: string;
  amountOz?: number;
  capped?: boolean;
  messages: string[];
  capfulHint?: string | null;
  safetyNote?: string | null;
};

type WaterTestRecord = {
  id: string;
  waterTestKitId: string | null;
  measurements: Array<{ metricKey: string; value: number; unit: string }>;
  recommendations?: Recommendation[];
};

type WaterCareResponse = {
  profile: {
    name: string;
    measurements: Array<{
      metricKey: string;
      label: string;
      unit: string;
      minValue: number;
      maxValue: number;
    }>;
  } | null;
  testingTips?: WaterCareTipsBlock;
  consent?: { needsAcceptance: boolean; policyVersion: string };
  waterTestKits?: WaterTestKit[];
  preferredWaterTestKitId?: string | null;
};

function getPrimarySpa(spaProfiles: SpaProfile[]): SpaProfile | null {
  return spaProfiles.find((spa) => spa.isPrimary) ?? spaProfiles[0] ?? null;
}

export default function WaterTestScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spa, setSpa] = useState<SpaProfile | null>(null);
  const [waterCare, setWaterCare] = useState<WaterCareResponse | null>(null);
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [savedResult, setSavedResult] = useState<WaterTestRecord | null>(null);
  const [retestHours, setRetestHours] = useState('2');

  const legal = waterCare?.testingTips?.legal;
  const activeKit = useMemo(
    () => waterCare?.waterTestKits?.find((k) => k.id === selectedKitId) ?? null,
    [waterCare?.waterTestKits, selectedKitId]
  );

  const visibleMeasurements = useMemo(() => {
    const all = waterCare?.profile?.measurements ?? [];
    if (!activeKit || activeKit.metrics.length === 0) return all;
    const keys = new Set(activeKit.metrics.map((m) => m.metricKey));
    return all.filter((m) => keys.has(m.metricKey));
  }, [waterCare?.profile?.measurements, activeKit]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSavedResult(null);
    try {
      const spaRes = (await api.get('/spa-profiles')) as { data?: { spaProfiles?: SpaProfile[] } };
      const spaProfiles = spaRes?.data?.spaProfiles ?? [];
      const primarySpa = getPrimarySpa(spaProfiles);
      setSpa(primarySpa);
      if (!primarySpa) {
        setWaterCare(null);
        return;
      }
      const waterCareRes = (await api.get(`/water-care/${primarySpa.id}`)) as { data?: WaterCareResponse };
      const resolved = waterCareRes?.data ?? null;
      setWaterCare(resolved);
      const pref = resolved?.preferredWaterTestKitId;
      const kits = resolved?.waterTestKits;
      const hasPref = pref && kits?.some((k) => k.id === pref);
      setSelectedKitId(hasPref ? pref : null);
      const initialValues: Record<string, string> = {};
      for (const measurement of resolved?.profile?.measurements ?? []) {
        initialValues[measurement.metricKey] = '';
      }
      setValues(initialValues);
    } catch {
      setError('Failed to load water test form');
      setSpa(null);
      setWaterCare(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function submitTest(withPolicyVersion?: string | null) {
    if (!spa || !waterCare?.profile) return;
    setSaving(true);
    setError(null);
    try {
      const measurements = visibleMeasurements
        .map((measurement) => ({
          metricKey: measurement.metricKey,
          value: Number(values[measurement.metricKey]),
        }))
        .filter((measurement) => Number.isFinite(measurement.value));

      const payload: Record<string, unknown> = {
        spaProfileId: spa.id,
        notes: notes.trim() || null,
        measurements,
        waterTestKitId: selectedKitId,
      };
      if (withPolicyVersion) payload.policyAcceptanceVersion = withPolicyVersion;

      const res = (await api.post('/water-tests', payload)) as { success?: boolean; data?: WaterTestRecord };
      setSavedResult(res.data ?? null);
      setConsentOpen(false);

      const h = Number(retestHours);
      if (Number.isFinite(h) && h > 0) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          const seconds = Math.max(60, Math.round(h * 3600));
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Retest your water',
              body: 'Time for a follow-up water test.',
              data: { url: `/(tabs)/water-test?spaProfileId=${spa.id}` },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
          });
        }
      }
    } catch (err: unknown) {
      const e = err as { error?: { code?: string; message?: string }; message?: string };
      if (e?.error?.code === 'CONSENT_REQUIRED') {
        setConsentOpen(true);
      } else {
        setError(e?.error?.message ?? e?.message ?? 'Failed to save water test');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    const needs = waterCare?.consent?.needsAcceptance && legal?.policyVersion;
    if (needs) {
      setConsentOpen(true);
      return;
    }
    void submitTest(null);
  }

  function handleConsentAndSave() {
    const v = legal?.policyVersion ?? '';
    void submitTest(v || null);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <AppPageHeader
        title="Log a Water Test"
        subtitle={
          spa
            ? spa.nickname?.trim() || [spa.brand, spa.modelLine || spa.model, spa.year].filter(Boolean).join(' · ')
            : 'Add a spa first to log a water test.'
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={consentOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{legal?.acknowledgmentTitle ?? 'Disclaimer'}</Text>
            <ScrollView style={styles.modalScroll}>
              <Text style={[styles.copy, { color: colors.textSecondary }]}>{legal?.acknowledgmentBody}</Text>
              {legal?.fullPolicyUrl ? (
                <Pressable onPress={() => void Linking.openURL(legal.fullPolicyUrl!)}>
                  <Text style={[styles.link, { color: colors.primary }]}>Full policy</Text>
                </Pressable>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setConsentOpen(false)} />
              <Button title="Accept & save test" onPress={handleConsentAndSave} loading={saving} />
            </View>
          </View>
        </View>
      </Modal>

      {!spa ? (
        <Text style={[styles.copy, { color: colors.textSecondary }]}>Add a spa first to log a water test.</Text>
      ) : !waterCare?.profile ? (
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          This spa does not have an Ideal Water Chemistry profile yet.
        </Text>
      ) : (
        <View style={styles.form}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Test kit (optional)</Text>
          <Pressable
            onPress={() => setSelectedKitId(null)}
            style={[
              styles.kitRow,
              { borderColor: colors.border, backgroundColor: colors.contentBackground },
              selectedKitId === null && { borderColor: colors.primary },
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: '600' }}>No specific kit</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Use profile defaults only</Text>
          </Pressable>
          <View style={styles.kitGrid}>
            {(waterCare.waterTestKits ?? []).map((kit) => (
              <Pressable
                key={kit.id}
                onPress={() => setSelectedKitId(kit.id)}
                style={[
                  styles.kitCard,
                  { borderColor: colors.border, backgroundColor: colors.contentBackground },
                  selectedKitId === kit.id && { borderColor: colors.primary },
                ]}
              >
                {kit.imageUrl ? (
                  <Image source={{ uri: kit.imageUrl }} style={styles.kitImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.kitImage, { backgroundColor: colors.border }]} />
                )}
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={2}>
                  {kit.title}
                </Text>
              </Pressable>
            ))}
          </View>

          {visibleMeasurements.map((measurement) => {
            const kitHelp = activeKit?.metrics?.find((m) => m.metricKey === measurement.metricKey)?.helpCopy;
            return (
              <View key={measurement.metricKey} style={[styles.card, { backgroundColor: colors.contentBackground }]}>
                <Text style={[styles.label, { color: colors.text }]}>{measurement.label}</Text>
                <Text style={[styles.helper, { color: colors.textMuted }]}>
                  Ideal: {measurement.minValue} - {measurement.maxValue} {measurement.unit}
                </Text>
                {kitHelp ? <Text style={[styles.helper, { color: colors.textSecondary }]}>{kitHelp}</Text> : null}
                <TextInput
                  keyboardType="decimal-pad"
                  value={values[measurement.metricKey] ?? ''}
                  onChangeText={(text) => setValues((current) => ({ ...current, [measurement.metricKey]: text }))}
                  placeholder={`Enter ${measurement.label}`}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>
            );
          })}

          <View style={[styles.card, { backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Optional notes"
              placeholderTextColor={colors.textMuted}
              style={[styles.textarea, { color: colors.text, borderColor: colors.border }]}
            />
          </View>

          <View style={[styles.card, { backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.label, { color: colors.text }]}>Local retest reminder (hours)</Text>
            <Text style={[styles.helper, { color: colors.textMuted }]}>
              Schedules a device notification; may be delayed by the OS.
            </Text>
            <TextInput
              keyboardType="number-pad"
              value={retestHours}
              onChangeText={setRetestHours}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
          </View>

          <Button
            title={saving ? 'Saving...' : 'Save Water Test'}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
          />

          {savedResult?.recommendations && savedResult.recommendations.length > 0 ? (
            <View style={[styles.card, { backgroundColor: colors.contentBackground }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Results & suggestions</Text>
              <Text style={[styles.helper, { color: colors.textMuted }]}>
                Informational only — follow product labels and your dealer&apos;s advice.
              </Text>
              {savedResult.recommendations.map((r) => (
                <View key={r.metricKey} style={styles.recBlock}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    {r.metricKey.replace(/_/g, ' ')} — {r.status}
                  </Text>
                  {r.suggestedChemical ? (
                    <Text style={{ color: colors.textSecondary }}>{r.suggestedChemical}</Text>
                  ) : null}
                  {r.amountOz != null ? (
                    <Text style={{ color: colors.textSecondary }}>~{r.amountOz} oz suggested starting dose</Text>
                  ) : null}
                  {r.capped ? <Text style={styles.warn}>Dose capped by safety limits.</Text> : null}
                  {r.capfulHint ? <Text style={{ color: colors.textSecondary }}>{r.capfulHint}</Text> : null}
                  {r.messages.map((m, i) => (
                    <Text key={i} style={{ color: colors.textSecondary, fontSize: 14 }}>
                      {m}
                    </Text>
                  ))}
                </View>
              ))}
              <Button title="Done" variant="secondary" onPress={() => router.back()} />
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  copy: { fontSize: 15, lineHeight: 22 },
  form: { gap: 14 },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  label: { fontSize: 16, fontWeight: '600' },
  helper: { fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  error: { color: '#b91c1c', fontSize: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  kitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kitCard: { width: '47%', borderRadius: 12, borderWidth: 2, padding: 8, gap: 6 },
  kitImage: { width: '100%', height: 72, borderRadius: 8 },
  kitRow: { borderRadius: 12, borderWidth: 2, padding: 12, gap: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { borderRadius: 16, padding: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalScroll: { maxHeight: 320, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  link: { marginTop: 8, textDecorationLine: 'underline' },
  recBlock: { marginTop: 12, gap: 4 },
  warn: { color: '#b45309', fontSize: 13 },
});
