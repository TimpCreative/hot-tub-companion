import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface TipItem {
  title: string;
  body: string;
}

export interface TipsListProps {
  title: string;
  items: TipItem[];
}

export function TipsListWidget({ title, items }: TipsListProps) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          marginBottom: spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        },
      ]}
    >
      <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.sm }]}>{title}</Text>
      {items.map((item, i) => (
        <View
          key={`${item.title}-${i}`}
          style={[
            styles.row,
            { borderBottomColor: colors.border, borderBottomWidth: i < items.length - 1 ? StyleSheet.hairlineWidth : 0 },
          ]}
        >
          <Text style={[typography.h3, { color: colors.text, fontSize: 16 }]}>{item.title}</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>{item.body}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  row: {
    paddingVertical: 14,
  },
});
