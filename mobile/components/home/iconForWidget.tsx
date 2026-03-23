import { Ionicons } from '@expo/vector-icons';
import React, { type ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

const MAP: Record<string, IconName> = {
  mail: 'mail-outline',
  water: 'water-outline',
  cart: 'cart-outline',
  book: 'book-outline',
  medkit: 'medkit-outline',
  build: 'build-outline',
  ellipse: 'ellipse-outline',
};

export function iconForWidgetKey(iconKey: string, size = 24, color = '#0d9488'): React.ReactElement {
  const name = MAP[iconKey] ?? MAP.ellipse;
  return <Ionicons name={name} size={size} color={color} />;
}
