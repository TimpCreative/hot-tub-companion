import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { AppPageHeader } from '../../components/AppPageHeader';
import { FinishSetupBanner } from '../../components/FinishSetupBanner';
import { useFinishSetupNudge } from '../../hooks/useFinishSetupNudge';
import { useTheme } from '../../theme/ThemeProvider';

export default function Shop() {
  const router = useRouter();
  const { showNudge, dismiss } = useFinishSetupNudge();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.center}>
        <AppPageHeader title="Shop" subtitle="Coming in Phase 2" />
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
  content: { flexGrow: 1, paddingBottom: 24 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 280,
    width: '100%',
  },
});
