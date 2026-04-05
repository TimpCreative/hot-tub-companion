import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../../contexts/AuthContext';
import { useCart } from '../../../contexts/CartContext';
import { messageFromApiReject } from '../../../services/cart';
import { useTheme } from '../../../theme/ThemeProvider';

export default function ShopCartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, typography } = useTheme();
  const { user } = useAuth();
  const { cart, loading, refreshCart, setLineQuantity, removeLine, openCheckout } = useCart();
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshCart();
    }, [refreshCart])
  );

  const onCheckout = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to check out.');
      return;
    }
    setCheckoutBusy(true);
    try {
      await openCheckout();
    } catch (e) {
      Alert.alert('Checkout', messageFromApiReject(e, 'Could not start checkout.'));
    } finally {
      setCheckoutBusy(false);
    }
  };

  const adjustQty = async (lineId: string, next: number) => {
    setBusyLine(lineId);
    try {
      if (next <= 0) {
        await removeLine(lineId);
      } else {
        await setLineQuantity(lineId, next);
      }
    } catch (e) {
      Alert.alert('Cart', messageFromApiReject(e, 'Update failed.'));
    } finally {
      setBusyLine(null);
    }
  };

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={[typography.body, { color: colors.text, textAlign: 'center' }]}>
          Sign in to view your cart and check out.
        </Text>
        <Pressable
          onPress={() => router.push('/auth/login')}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1, marginTop: 16 },
          ]}
        >
          <Text style={styles.primaryBtnText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
    >
      {loading && !cart ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : null}

      {!loading && (!cart || cart.lines.length === 0) ? (
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 24, textAlign: 'center' }]}>
          Your cart is empty. Browse the shop to add items.
        </Text>
      ) : null}

      {cart?.lines.map((line) => (
        <View
          key={line.id}
          style={[styles.lineCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]} numberOfLines={2}>
            {line.productTitle}
          </Text>
          {line.variantTitle ? (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={2}>
              {line.variantTitle}
            </Text>
          ) : null}
          <View style={styles.lineActions}>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => adjustQty(line.id, line.quantity - 1)}
                disabled={busyLine === line.id}
                style={({ pressed }) => [
                  styles.stepBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Ionicons name="remove" size={20} color={colors.primary} />
              </Pressable>
              <Text style={[typography.body, { color: colors.text, minWidth: 28, textAlign: 'center' }]}>
                {line.quantity}
              </Text>
              <Pressable
                onPress={() => adjustQty(line.id, line.quantity + 1)}
                disabled={busyLine === line.id}
                style={({ pressed }) => [
                  styles.stepBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => adjustQty(line.id, 0)}
              disabled={busyLine === line.id}
              hitSlop={8}
            >
              <Text style={{ color: '#b91c1c', fontWeight: '600' }}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {cart && cart.lines.length > 0 ? (
        <Pressable
          onPress={() => void onCheckout()}
          disabled={checkoutBusy}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed || checkoutBusy ? 0.88 : 1,
              marginTop: 20,
            },
          ]}
        >
          {checkoutBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Check out</Text>
          )}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lineCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  lineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
