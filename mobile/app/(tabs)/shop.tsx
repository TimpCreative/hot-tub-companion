import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { FinishSetupBanner } from '../../components/FinishSetupBanner';
import { useFinishSetupNudge } from '../../hooks/useFinishSetupNudge';

export default function Shop() {
  const router = useRouter();
  const { showNudge } = useFinishSetupNudge();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {showNudge ? (
        <FinishSetupBanner onContinue={() => router.push('/onboarding')} />
      ) : null}
      <View style={styles.center}>
        <Text style={styles.title}>Shop</Text>
        <Text style={styles.subtitle}>Coming in Phase 2</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 24 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 280,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    color: '#666',
  },
});
