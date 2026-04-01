import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface DealerCardProps {
  tenantName: string;
  phone: string | null;
  address: string | null;
  title?: string;
  subtitle?: string;
}

export function DealerCardWidget({ tenantName, phone, address, title = 'Your dealership', subtitle = 'We are here to help' }: DealerCardProps) {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();

  const primaryHex = colors.primary ?? '#1B4D7A';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: '#f0f9ff',
          borderColor: `${primaryHex}25`,
          borderWidth: 1,
          opacity: pressed ? 0.92 : 1,
          marginBottom: spacing.md,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        },
      ]}
      onPress={() => router.push('/dealer' as Href)}
    >
      <View style={styles.titleRow}>
        <Ionicons name="business-outline" size={20} color={primaryHex} style={{ marginRight: 8 }} />
        <Text style={[typography.h3, { color: colors.text, fontSize: 17 }]}>{title}</Text>
      </View>
      <Text style={[typography.body, { color: colors.textSecondary }]}>{subtitle}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{tenantName}</Text>
      {phone ? (
        <Text style={[typography.body, { color: colors.primary, marginTop: 8 }]}>{phone}</Text>
      ) : null}
      {address ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>{address}</Text>
      ) : null}
      <Text style={[typography.caption, { color: colors.primary, marginTop: 10 }]}>View dealer & services ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
});
