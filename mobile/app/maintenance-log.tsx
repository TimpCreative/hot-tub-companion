import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import api from '../services/api';
import { useTheme } from '../theme/ThemeProvider';

type SpaProfile = {
  id: string;
  brand?: string | null;
  modelLine?: string | null;
  model?: string | null;
  year?: number | null;
  nickname?: string | null;
  isPrimary?: boolean;
};

type WaterTest = {
  id: string;
  testedAt: string;
  notes: string | null;
  measurements: Array<{
    id: string;
    metricKey: string;
    value: number;
    unit: string;
  }>;
};

function getPrimarySpa(spaProfiles: SpaProfile[]): SpaProfile | null {
  return spaProfiles.find((spa) => spa.isPrimary) ?? spaProfiles[0] ?? null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMetricKey(metricKey: string): string {
  return metricKey
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function MaintenanceLogScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spa, setSpa] = useState<SpaProfile | null>(null);
  const [tests, setTests] = useState<WaterTest[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const spaRes = (await api.get('/spa-profiles')) as { data?: { spaProfiles?: SpaProfile[] } };
      const spaProfiles = spaRes?.data?.spaProfiles ?? [];
      const primarySpa = getPrimarySpa(spaProfiles);
      setSpa(primarySpa);
      if (!primarySpa) {
        setTests([]);
        return;
      }
      const testsRes = (await api.get(`/water-tests/${primarySpa.id}`)) as { data?: { tests?: WaterTest[] } };
      setTests(testsRes?.data?.tests ?? []);
    } catch {
      setError('Failed to load maintenance log');
      setSpa(null);
      setTests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Water Test History</Text>
      {spa ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {spa.nickname?.trim() || [spa.brand, spa.modelLine || spa.model, spa.year].filter(Boolean).join(' · ')}
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!spa ? (
        <Text style={[styles.copy, { color: colors.textSecondary }]}>Add a spa first to view history.</Text>
      ) : tests.length === 0 ? (
        <Text style={[styles.copy, { color: colors.textSecondary }]}>No water tests logged yet.</Text>
      ) : (
        tests.map((test) => (
          <View key={test.id} style={[styles.card, { backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{formatDate(test.testedAt)}</Text>
            <View style={styles.measurements}>
              {test.measurements.map((measurement) => (
                <Text key={measurement.id} style={[styles.measurement, { color: colors.textSecondary }]}>
                  {formatMetricKey(measurement.metricKey)}: {measurement.value} {measurement.unit}
                </Text>
              ))}
            </View>
            {test.notes ? <Text style={[styles.notes, { color: colors.textMuted }]}>{test.notes}</Text> : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  copy: { fontSize: 15, lineHeight: 22 },
  card: { borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  measurements: { gap: 4 },
  measurement: { fontSize: 14 },
  notes: { fontSize: 13, lineHeight: 18 },
  error: { color: '#b91c1c', fontSize: 14 },
});
