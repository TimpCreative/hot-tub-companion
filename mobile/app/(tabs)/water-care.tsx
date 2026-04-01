import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import { StatusBarBar } from '../../components/StatusBarBar';
import { useTenant } from '../../contexts/TenantContext';
import { shiftHueSaturateHex } from '../../lib/colorUtils';
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
  const primaryHex = colors.primary ?? '#1B4D7A';
  const gradientStart = shiftHueSaturateHex(primaryHex, 16, 1.25);
  const gradientColors = [gradientStart, primaryHex] as const;
  const scrollY = useRef(new Animated.Value(0)).current;

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
    {
      label: 'Water Test',
      description: 'Test your water and get recommendations',
      icon: 'flask-outline' as const,
      route: '/water-test',
      accent: '#0891b2',
      accentSoft: 'rgba(8,145,178,0.10)',
      border: 'rgba(56,189,248,0.35)',
    },
    {
      label: 'Guides & Videos',
      description: 'Step-by-step instructions for care',
      icon: 'play-circle-outline' as const,
      route: '/water-guides',
      accent: '#7c3aed',
      accentSoft: 'rgba(124,58,237,0.10)',
      border: 'rgba(167,139,250,0.35)',
    },
    {
      label: 'Maintenance Log',
      description: 'View your test history and maintenance',
      icon: 'build-outline' as const,
      route: '/maintenance-log',
      accent: '#475569',
      accentSoft: 'rgba(71,85,105,0.10)',
      border: 'rgba(148,163,184,0.35)',
    },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <StatusBarBar primaryColor={primaryHex} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBarBar primaryColor={primaryHex} scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 20, marginHorizontal: -24 }]}
        >
          <View style={styles.heroTitleRow}>
            <Ionicons name="water-outline" size={28} color="#fff" />
            <Text style={styles.heroTitle}>Water Care</Text>
          </View>
          <Text style={styles.heroSubtitle}>Test, track & learn</Text>
        </LinearGradient>

        {!spa ? (
          <View style={[styles.card, styles.sectionCard, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}>
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
            <View style={styles.sectionStack}>
              {topActions.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: colors.contentBackground,
                      borderColor: action.border,
                    },
                  ]}
                  onPress={() => router.push(action.route)}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: action.accentSoft }]}>
                    <Ionicons name={action.icon} size={26} color={action.accent} />
                  </View>
                  <View style={styles.actionCopy}>
                    <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
                    <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>{action.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={action.accent} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.card, styles.sectionCard, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Ideal Water Chemistry</Text>
              {waterCare?.profile ? (
                <>
                  <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>Target ranges for your hot tub</Text>
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
                      <View
                        key={measurement.metricKey}
                        style={[styles.measurementCard, { backgroundColor: '#f8fafc', borderColor: '#eef2ff' }]}
                      >
                        <View style={styles.measurementHeader}>
                          <Text style={[styles.measurementLabel, { color: colors.text }]}>{measurement.label}</Text>
                          <View style={[styles.measurementMeta, measurement.recentValue == null && styles.measurementMetaWide]}>
                            <Text style={[styles.measurementValue, { color: colors.text }]}>
                              {measurement.idealMin} - {measurement.idealMax} {measurement.unit}
                            </Text>
                            <Text style={[styles.statusPill, { color: statusColor(measurement.status) }]}>
                              {statusLabel(measurement.status)}
                            </Text>
                          </View>
                        </View>
                        {measurement.recentValue != null ? (
                          <Text style={[styles.measurementRecent, { color: colors.textSecondary }]}>
                            Recent: {measurement.recentValue} {measurement.unit}
                          </Text>
                        ) : null}
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

            <View
              style={[
                styles.card,
                styles.sectionCard,
                styles.tipCard,
                { backgroundColor: '#eff6ff', borderColor: 'rgba(96,165,250,0.35)' },
              ]}
            >
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
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 24 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    marginTop: -24,
    marginBottom: 18,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    marginTop: 8,
    fontWeight: '500',
  },
  body: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 24,
  },
  sectionStack: {
    gap: 16,
    marginBottom: 24,
  },
  actionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 118,
  },
  actionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  sectionCard: {
    borderWidth: 1,
  },
  tipCard: {
    marginBottom: 0,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  measurementLabel: {
    fontSize: 17,
    fontWeight: '500',
    flex: 1,
  },
  measurementMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  measurementMetaWide: {
    flex: 1,
  },
  measurementValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  statusPill: {
    fontSize: 12,
    fontWeight: '700',
  },
  measurementRecent: {
    fontSize: 13,
    marginTop: 8,
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
