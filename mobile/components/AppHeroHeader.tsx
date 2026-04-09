import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shiftHueSaturateHex } from '../lib/colorUtils';
import { useTheme } from '../theme/ThemeProvider';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface AppHeroHeaderProps {
  title?: string;
  subtitle?: string;
  icon?: IoniconName;
  /** e.g. cart icon with badge (shop header). */
  trailing?: ReactNode;
  /** When set, shows Back above the title row (for screens with `headerShown: false`). */
  onBackPress?: () => void;
}

export function AppHeroHeader({ title, subtitle, icon, trailing, onBackPress }: AppHeroHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const primaryHex = colors.primary ?? '#1B4D7A';
  const gradientStart = shiftHueSaturateHex(primaryHex, 16, 1.25);

  return (
    <LinearGradient
      colors={[gradientStart, primaryHex]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + 20 }]}
    >
      {onBackPress ? (
        <Pressable
          onPress={onBackPress}
          hitSlop={12}
          style={({ pressed }) => [styles.backRow, { opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      ) : null}
      {icon || title || trailing ? (
        <View style={styles.titleRow}>
          {icon ? <Ionicons name={icon} size={28} color="#fff" /> : null}
          {title ? (
            <Text style={[styles.title, styles.titleFlex]} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {trailing ? <View style={styles.trailingWrap}>{trailing}</View> : null}
        </View>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    marginHorizontal: -24,
    marginTop: -24,
    marginBottom: 18,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleFlex: {
    flex: 1,
    flexShrink: 1,
  },
  trailingWrap: {
    marginLeft: 'auto',
    flexShrink: 0,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
});
