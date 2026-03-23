import React from 'react';
import { StyleSheet, View } from 'react-native';

type Bubble = { top?: number; bottom?: number; left?: number; right?: number; size: number; opacity: number };

const BUBBLES: Bubble[] = [
  { top: -70, right: -50, size: 220, opacity: 0.2 },
  { top: 40, left: -80, size: 260, opacity: 0.12 },
  { bottom: 20, right: -40, size: 180, opacity: 0.16 },
  { top: 120, right: 20, size: 120, opacity: 0.1 },
];

/**
 * Large overlapping circles — white at low opacity for soft water/spa texture.
 */
export function HomeHeroBubbles() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {BUBBLES.map((b, i) => (
        <View
          key={i}
          style={[
            styles.circle,
            {
              width: b.size,
              height: b.size,
              borderRadius: b.size / 2,
              backgroundColor: `rgba(255,255,255,${b.opacity})`,
              top: b.top,
              bottom: b.bottom,
              left: b.left,
              right: b.right,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
  },
});
