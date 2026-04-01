import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import { useTenant } from '../../contexts/TenantContext';
import { useTheme } from '../../theme/ThemeProvider';

type SpaProfile = {
  id: string;
  brand?: string | null;
  modelLine?: string | null;
  model?: string | null;
  year?: number | null;
  nickname?: string | null;
  isPrimary?: boolean;
  sanitizationSystem?: string | null;
};

type WaterCareResponse = {
  spaProfileId: string;
  sanitationSystem: string | null;
  source: { scopeType: string } | null;
  latestTestId: string | null;
  latestTestDate: string | null;
  latestMeasurements: Array<{
    id: string;
    metricKey: string;
    value: number;
    unit: string;
  }>;
  comparison: Array<{
    metricKey: string;
    label: string;
    unit: string;
    idealMin: number;
    idealMax: number;
    recentValue: number | null;
    status: 'low' | 'in_range' | 'high' | 'missing';
  }>;
  profile: {
    name: string;
    description?: string | null;
    notes?: string | null;
    measurements: Array<{
      id: string;
      metricKey: string;
      label: string;
      unit: string;
      minValue: number;
      maxValue: number;
    }>;
  } | null;
  testingTips?: {
    testingTipsTitle: string;
    testingTips: Array<{ text: string }>;
  };
};

function getPrimarySpa(spaProfiles: SpaProfile[]): SpaProfile | null {
  const primary = spaProfiles.find((spa) => spa.isPrimary);
  return primary ?? spaProfiles[0] ?? null;
}

function spaSummary(spa: SpaProfile | null): string {
  if (!spa) return 'No spa selected';
  if (spa.nickname?.trim()) return spa.nickname.trim();
  return [spa.brand, spa.modelLine || spa.model, spa.year].filter(Boolean).join(' ') || 'Spa';
}

function formatShortDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function WaterCareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { config } = useTenant();
  const [loading, setLoading] = useState(true);
  const [spa, setSpa] = useState<SpaProfile | null>(null);
  const [waterCare, setWaterCare] = useState<WaterCareResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const spaRes = (await api.get('/spa-profiles')) as { data?: { spaProfiles?: SpaProfile[] } };
      const spaProfiles = spaRes?.data?.spaProfiles ?? [];
      const primarySpa = getPrimarySpa(spaProfiles);
      setSpa(primarySpa);
      if (primarySpa) {
        const waterCareRes = (await api.get(`/water-care/${primarySpa.id}`)) as { data?: WaterCareResponse };
        setWaterCare(waterCareRes?.data ?? null);
      } else {
        setWaterCare(null);
      }
    } catch {
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

  const testingTips = useMemo(() => {
    return waterCare?.testingTips ?? config?.waterCare ?? { testingTipsTitle: 'Water Testing Tips', testingTips: [] };
  }, [config?.waterCare, waterCare?.testingTips]);

  const comparisonRows = waterCare?.comparison ?? [];

  function statusColor(status: 'low' | 'in_range' | 'high' | 'missing') {
    if (status === 'in_range') return '#15803d';
    if (status === 'low') return '#b45309';
    if (status === 'high') return '#b91c1c';
    return colors.textMuted;
  }

  function statusLabel(status: 'low' | 'in_range' | 'high' | 'missing') {
    if (status === 'in_range') return 'In Range';
    if (status === 'low') return 'Low';
    if (status === 'high') return 'High';
    return '-';
  }

  const topActions = [
    { label: 'Water Test', icon: 'flask-outline' as const, route: '/water-test' },
    { label: 'Guides & Videos', icon: 'play-circle-outline' as const, route: '/water-guides' },
    { label: 'Maintenance Log', icon: 'build-outline' as const, route: '/maintenance-log' },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text }]}>Water Care</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Ideal chemistry ranges and tips for {spaSummary(spa)}.
        </Text>

        {!spa ? (
          <View style={[styles.card, { backgroundColor: colors.contentBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Finish spa setup</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Add your spa to unlock Water Care ranges and recommendations.
            </Text>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/onboarding')}>
              <Text style={styles.actionButtonText}>Set Up My Spa</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.actionGrid}>
              {topActions.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={[styles.actionCard, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}
                  onPress={() => router.push(action.route)}
                >
                  <Ionicons name={action.icon} size={24} color={colors.primary} />
                  <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: colors.contentBackground }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Ideal Water Chemistry</Text>
              {waterCare?.profile ? (
                <>
                  <Text style={[styles.testedAtText, { color: colors.textMuted }]}>
                    Recent Test: {formatShortDate(waterCare.latestTestDate)}
                  </Text>
                  <Text style={[styles.profileName, { color: colors.text }]}>
                    {waterCare.profile.name}
                    {waterCare.source ? ` · ${waterCare.source.scopeType}` : ''}
                  </Text>
                  {waterCare.profile.description ? (
                    <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{waterCare.profile.description}</Text>
                  ) : null}
                  <View style={styles.measurements}>
                    {comparisonRows.map((measurement) => (
                      <View key={measurement.metricKey} style={[styles.measurementCard, { borderColor: colors.border }]}>
                        <View style={styles.measurementHeader}>
                          <Text style={[styles.measurementLabel, { color: colors.text }]}>{measurement.label}</Text>
                          <Text style={[styles.statusPill, { color: statusColor(measurement.status) }]}>
                            {statusLabel(measurement.status)}
                          </Text>
                        </View>
                        <Text style={[styles.measurementRange, { color: colors.primary }]}>
                          Ideal: {measurement.idealMin} - {measurement.idealMax} {measurement.unit}
                        </Text>
                        <Text style={[styles.measurementRecent, { color: colors.textSecondary }]}>
                          Recent: {measurement.recentValue == null ? '-' : `${measurement.recentValue} ${measurement.unit}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {waterCare.profile.notes ? (
                    <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{waterCare.profile.notes}</Text>
                  ) : null}
                </>
              ) : (
                <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
                  No chemistry profile has been mapped for this spa yet.
                </Text>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.contentBackground }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {testingTips.testingTipsTitle || 'Water Testing Tips'}
              </Text>
              {testingTips.testingTips.length > 0 ? (
                testingTips.testingTips.map((tip, index) => (
                  <View key={`${tip.text}-${index}`} style={styles.tipRow}>
                    <Text style={[styles.tipBullet, { color: colors.primary }]}>•</Text>
                    <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip.text}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
                  Your retailer has not added custom testing tips yet.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 24 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  testedAtText: {
    fontSize: 13,
    marginBottom: 8,
  },
  measurements: {
    gap: 10,
    marginVertical: 12,
  },
  measurementCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  measurementLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusPill: {
    fontSize: 12,
    fontWeight: '700',
  },
  measurementRange: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  measurementRecent: {
    fontSize: 13,
    marginTop: 4,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  tipBullet: {
    fontSize: 18,
    lineHeight: 20,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  actionButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
