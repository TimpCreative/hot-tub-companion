import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { QuickLink } from '../../contexts/TenantContext';
import { LinkTileWidget } from './LinkTileWidget';
import { useTheme } from '../../theme/ThemeProvider';

export function QuickLinksGrid({
  links,
  layout,
}: {
  links: QuickLink[];
  layout: 'single' | 'double';
}) {
  const { spacing } = useTheme();
  const compact = layout === 'double';

  if (layout === 'single') {
    return (
      <View style={[styles.list, { marginBottom: spacing.md }]}>
        {links.map((link) => (
          <LinkTileWidget
            key={link.id}
            title={link.title}
            subtitle={link.subtitle}
            targetRoute={link.targetRoute}
            iconKey={link.iconKey}
            iconColor={link.iconColor}
            iconBgColor={link.iconBgColor}
          />
        ))}
      </View>
    );
  }

  const gap = spacing.sm ?? 8;
  return (
    <View style={[styles.grid, { gap, marginBottom: spacing.md }]}>
      {links.map((link) => (
        <View key={link.id} style={styles.gridItem}>
          <LinkTileWidget
            title={link.title}
            targetRoute={link.targetRoute}
            iconKey={link.iconKey}
            iconColor={link.iconColor}
            iconBgColor={link.iconBgColor}
            compact
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '48%',
  },
});
