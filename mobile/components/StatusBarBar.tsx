import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BAR_THRESHOLD = 60;

interface StatusBarBarProps {
  primaryColor: string;
  /** When provided, bar animates in on scroll. When undefined, bar is always visible. */
  scrollY?: Animated.Value;
}

/**
 * Primary-colored bar for the status bar area (clock/battery).
 * When scrollY is provided, bar slides into view on scroll so the status bar remains readable over light content.
 * When scrollY is omitted, bar is always visible (for non-scrollable screens).
 */
export function StatusBarBar({ primaryColor, scrollY }: StatusBarBarProps) {
  const insets = useSafeAreaInsets();

  if (!scrollY) {
    return (
      <View
        style={[
          styles.bar,
          { height: insets.top, backgroundColor: primaryColor },
        ]}
        pointerEvents="none"
      />
    );
  }

  const barTranslateY = scrollY.interpolate({
    inputRange: [0, BAR_THRESHOLD],
    outputRange: [-insets.top, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height: insets.top,
          backgroundColor: primaryColor,
          transform: [{ translateY: barTranslateY }],
        },
      ]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
