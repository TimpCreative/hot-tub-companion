import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { iconForWidgetKey } from './iconForWidget';

export interface LinkTileProps {
  title: string;
  subtitle?: string;
  targetRoute: string;
  iconKey: string;
}

export function LinkTileWidget({ title, subtitle, targetRoute, iconKey }: LinkTileProps) {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
          marginBottom: spacing.md,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        },
      ]}
      onPress={() => router.push(targetRoute as Href)}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
        {iconForWidgetKey(iconKey, 26, colors.primary ?? '#0d9488')}
      </View>
      <View style={styles.textCol}>
        <Text style={[typography.h3, { color: colors.text, fontSize: 17 }]}>{title}</Text>
        {subtitle ? (
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 20 }}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textCol: { flex: 1 },
});
