import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/ui/Button';
import { StatusBarBar } from '../components/StatusBarBar';
import { setWelcomeSeenFlag } from '../lib/welcomeSeenStorage';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { modelName } = useLocalSearchParams<{ modelName?: string }>();
  const { user } = useAuth();
  const { config } = useTenant();
  const { colors } = useTheme();

  const tenantName = config?.name ?? 'Your retailer';
  const firstName = user?.firstName?.trim() || 'there';
  const displayModelName = modelName?.trim() || 'your spa';

  const wb = config?.onboarding?.welcomeBlock;
  const line1Template = wb?.greetingLine1?.trim() || 'Hey, {{name}}!';
  const line2Template = wb?.greetingLine2?.trim() || 'Welcome to {{retailer}}';
  const line1 = line1Template.replace(/\{\{name\}\}/gi, firstName);
  const line2 = line2Template.replace(/\{\{retailer\}\}/gi, tenantName);

  const handleGetStarted = async () => {
    await setWelcomeSeenFlag();
    router.replace('/(tabs)/home');
  };

  const screenBg = '#F2F4F8';
  const cardBg = '#FFFFFF';
  const primaryHex = colors.primary ?? '#1B4D7A';
  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      <StatusBarBar primaryColor={primaryHex} scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
      <View style={styles.header}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
          {config?.branding?.iconUrl ? (
            <Image source={{ uri: config.branding.iconUrl }} style={styles.logoImg} resizeMode="contain" />
          ) : (
            <Text style={styles.logoFallback}>HT</Text>
          )}
        </View>
        <Text style={[styles.greetingLine1, { color: colors.text }]}>{line1}</Text>
        <Text style={[styles.greetingLine2, { color: colors.primary }]}>{line2}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <View style={styles.propRow}>
          <Ionicons name="cart-outline" size={22} color={colors.primary} style={styles.propIcon} />
          <Text style={[styles.propText, { color: colors.text }]}>
            Shop products made for your {displayModelName}
          </Text>
        </View>
        <View style={styles.propRow}>
          <Ionicons name="construct-outline" size={22} color={colors.primary} style={styles.propIcon} />
          <Text style={[styles.propText, { color: colors.text }]}>Schedule service with a tap</Text>
        </View>
        <View style={styles.propRow}>
          <Ionicons name="water-outline" size={22} color={colors.primary} style={styles.propIcon} />
          <Text style={[styles.propText, { color: colors.text }]}>Track your water care</Text>
        </View>

        <View style={styles.ctaWrap}>
          <Button title="Get Started" onPress={handleGetStarted} />
        </View>
      </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoImg: { width: 44, height: 44 },
  logoFallback: { color: '#fff', fontWeight: '800', fontSize: 22 },
  greetingLine1: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  greetingLine2: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  propRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  propIcon: { marginRight: 12 },
  propText: {
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
  },
  ctaWrap: { marginTop: 16 },
});
