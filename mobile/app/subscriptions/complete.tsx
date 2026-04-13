import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';

export default function SubscriptionCompleteScreen() {
  const { colors, typography } = useTheme();
  const router = useRouter();
  const { status, session_id: sessionId } = useLocalSearchParams<{
    status?: string;
    session_id?: string;
  }>();

  const title = useMemo(() => {
    if (status === 'success') return 'Subscription confirmed';
    if (status === 'cancel') return 'Checkout canceled';
    if (status === 'portal_return') return 'Billing';
    return 'Subscription';
  }, [status]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <Text style={[typography.body, styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12 }]}>
        {status === 'success'
          ? 'Thank you! Your subscription is processing. You can manage it anytime from Profile → Subscriptions.'
          : status === 'cancel'
            ? 'No payment was taken. You can subscribe again from a product page.'
            : 'You can continue in the app.'}
      </Text>
      {sessionId ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 16 }]}>
          Reference: {String(sessionId).slice(0, 24)}…
        </Text>
      ) : null}
      <Pressable
        style={[styles.btn, { backgroundColor: colors.primary, marginTop: 28 }]}
        onPress={() => router.replace('/(tabs)/profile')}
      >
        <Text style={styles.btnText}>Back to profile</Text>
      </Pressable>
      <Pressable
        style={[styles.btnSecondary, { borderColor: colors.primary, marginTop: 12 }]}
        onPress={() => router.push('/(tabs)/profile/subscriptions')}
      >
        <Text style={[styles.btnSecondaryText, { color: colors.primary }]}>View subscriptions</Text>
      </Pressable>
      <Pressable style={{ marginTop: 16 }} onPress={() => router.replace('/(tabs)/home')}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: '800' },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnSecondary: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 2 },
  btnSecondaryText: { fontWeight: '700', fontSize: 16 },
});
