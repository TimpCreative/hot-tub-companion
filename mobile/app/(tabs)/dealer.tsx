import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTenant } from '../../contexts/TenantContext';
import { useTheme } from '../../theme/ThemeProvider';

export default function DealerScreen() {
  const { config } = useTenant();
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const name = config?.name ?? 'Your retailer';
  const phone = config?.dealerContact?.phone;
  const address = config?.dealerContact?.address;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{name}</Text>
      {phone ? (
        <Text style={[typography.body, { color: colors.primary, marginTop: spacing.sm }]}>{phone}</Text>
      ) : null}
      {address ? (
        <Text style={[styles.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>{address}</Text>
      ) : (
        <Text style={[styles.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          Hours and location — ask your retailer to add public contact in App setup.
        </Text>
      )}
      <Pressable
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1, marginTop: spacing.lg },
        ]}
        onPress={() => router.push('/services')}
      >
        <Text style={styles.ctaText}>Services & scheduling</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  cta: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
