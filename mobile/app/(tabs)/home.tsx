import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FinishSetupBanner } from '../../components/FinishSetupBanner';
import { HomeHeroBubbles } from '../../components/home/HomeHeroBubbles';
import { HomeWidgetRenderer } from '../../components/home/HomeWidgetRenderer';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useFinishSetupNudge } from '../../hooks/useFinishSetupNudge';
import { shiftHueSaturateHex } from '../../lib/colorUtils';
import { DEFAULT_HOME_DASHBOARD } from '../../lib/homeDashboardDefaults';
import api from '../../services/api';
import { useTheme } from '../../theme/ThemeProvider';

type SpaProfile = {
  id: string;
  brand?: string | null;
  modelLine?: string | null;
  model?: string | null;
  year?: number | null;
  nickname?: string | null;
  sanitizationSystem?: string | null;
  isPrimary?: boolean;
};

function pickPrimary(profiles: SpaProfile[]): SpaProfile | null {
  const primary = profiles.find((p) => p.isPrimary);
  if (primary) return primary;
  return profiles[0] ?? null;
}

function spaSummaryLine(p: SpaProfile): string {
  const parts = [p.brand, p.modelLine || p.model, p.year ? String(p.year) : null].filter(Boolean);
  return parts.join(' · ') || 'Your spa';
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { config } = useTenant();
  const { colors, typography, spacing } = useTheme();
  const { showNudge, dismiss } = useFinishSetupNudge();
  const [spa, setSpa] = useState<SpaProfile | null>(null);

  const dashboard = config?.homeDashboard ?? DEFAULT_HOME_DASHBOARD;
  const widgets = [...(dashboard.widgets ?? [])]
    .filter((w) => w.enabled)
    .sort((a, b) => a.order - b.order);

  const loadSpa = useCallback(async () => {
    if (!user) {
      setSpa(null);
      return;
    }
    try {
      const res = (await api.get('/spa-profiles')) as { data?: { spaProfiles?: SpaProfile[] } };
      const list = res?.data?.spaProfiles ?? [];
      setSpa(pickPrimary(list));
    } catch {
      setSpa(null);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadSpa();
    }, [loadSpa])
  );

  const tenantName = config?.name ?? 'Your retailer';
  const primaryHex = colors.primary ?? '#1B4D7A';
  const gradientStart = shiftHueSaturateHex(primaryHex, 16, 1.25);
  const gradientColors = [gradientStart, primaryHex] as const;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 24 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.hero,
            {
              paddingTop: insets.top + spacing.lg,
              marginBottom: -36,
            },
          ]}
        >
          <HomeHeroBubbles />
          <Text style={styles.heroWelcome}>Welcome to</Text>
          <Text style={[typography.h1, styles.heroTenant]}>{tenantName}</Text>
          <Text style={styles.heroTagline}>Your Hot Tub Care Partner</Text>
        {spa ? (
          <View style={styles.spaCard}>
            <Text style={styles.spaLabel}>Your spa</Text>
            <Text style={styles.spaTitle}>{spaSummaryLine(spa)}</Text>
            {spa.nickname ? <Text style={styles.spaNick}>{spa.nickname}</Text> : null}
            {spa.sanitizationSystem ? (
              <Text style={styles.spaMeta}>Sanitizer: {spa.sanitizationSystem.replace(/_/g, ' ')}</Text>
            ) : null}
          </View>
        ) : user ? (
          <View style={styles.spaCard}>
            <Text style={styles.spaLabel}>Your spa</Text>
            <Text style={styles.spaTitle}>Add your spa model</Text>
            <Text
              style={styles.spaLink}
              onPress={() => router.push('/onboarding')}
            >
              Finish setup →
            </Text>
          </View>
        ) : null}
        </LinearGradient>

        <View style={{ marginTop: -36, flex: 1, minHeight: 400 }}>
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xl ?? 24,
            }}
          >
          <View
            style={{
              position: 'absolute',
              top: 36,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.contentBackground ?? '#f8fafc',
              zIndex: -1,
            }}
          />
        {widgets.map((w) => (
          <HomeWidgetRenderer
            key={w.id}
            widget={w}
            tenantName={tenantName}
            dealerContact={config?.dealerContact}
            sanitizationLabel={spa?.sanitizationSystem ?? null}
          />
        ))}
          </View>
        </View>
      </ScrollView>
      {showNudge ? (
        <FinishSetupBanner
          onContinue={() => router.push('/onboarding')}
          onDismiss={dismiss}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  heroWelcome: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 4,
  },
  heroTenant: {
    color: '#fff',
    marginTop: 4,
    fontSize: 26,
    fontWeight: '700',
  },
  heroTagline: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  spaCard: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  spaLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  spaTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  spaNick: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontSize: 15,
  },
  spaMeta: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    fontSize: 13,
  },
  spaLink: {
    color: '#fff',
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
