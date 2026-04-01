import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  async function handleSave() {
    if (!spa || !waterCare?.profile) return;
    setSaving(true);
    setError(null);
    try {
      const measurements = waterCare.profile.measurements
        .map((measurement) => ({
          metricKey: measurement.metricKey,
          value: Number(values[measurement.metricKey]),
        }))
        .filter((measurement) => Number.isFinite(measurement.value));

      await api.post('/water-tests', {
        spaProfileId: spa.id,
        notes: notes.trim() || null,
        measurements,
      });
      router.back();
    } catch (err) {
      if (err && typeof err === 'object' && 'error' in err) {
        setError((err as { error?: { message?: string } }).error?.message ?? 'Failed to save water test');
      } else {
        setError('Failed to save water test');
      }
    } finally {
      setSaving(false);
    }
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

      {!spa ? (
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          Add a spa first to log a water test.
        </Text>
      ) : !waterCare?.profile ? (
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          This spa does not have an Ideal Water Chemistry profile yet.
        </Text>
      ) : (
        <View style={styles.form}>
          {waterCare.profile.measurements.map((measurement) => (
            <View key={measurement.metricKey} style={[styles.card, { backgroundColor: colors.contentBackground }]}>
              <Text style={[styles.label, { color: colors.text }]}>{measurement.label}</Text>
              <Text style={[styles.helper, { color: colors.textMuted }]}>
                Ideal: {measurement.minValue} - {measurement.maxValue} {measurement.unit}
              </Text>
              <TextInput
                keyboardType="decimal-pad"
                value={values[measurement.metricKey] ?? ''}
                onChangeText={(text) => setValues((current) => ({ ...current, [measurement.metricKey]: text }))}
                placeholder={`Enter ${measurement.label}`}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />
            </View>
          ))}

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

          <Button
            title={saving ? 'Saving...' : 'Save Water Test'}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 16 },
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
});
