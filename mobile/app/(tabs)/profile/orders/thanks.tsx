import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../../components/ui/Button';
import { useTheme } from '../../../../theme/ThemeProvider';

export default function CheckoutThanksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>
      <Text style={[typography.h2, { color: colors.text }]}>Thank you</Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12, lineHeight: 22 }]}>
        Your order is being processed. It may take a moment to appear in your order history after the store confirms it.
      </Text>
      <View style={styles.actions}>
        <Button title="View orders" onPress={() => router.replace('/(tabs)/profile/orders')} />
        <Button title="Back to Home" variant="outline" onPress={() => router.replace('/(tabs)/home')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  actions: {
    marginTop: 28,
    gap: 12,
  },
});
