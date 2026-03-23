import { useTheme } from '../theme/ThemeProvider';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { setFinishSetupDismissedAt } from '../lib/finishSetupDismissStorage';

type Props = {
  onContinue: () => void;
  onDismiss: () => void;
};

export function FinishSetupBanner({ onContinue, onDismiss }: Props) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(150)).current;
  const heightRef = useRef(0);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderRelease: (_, g) => {
        if (g.vy > 0.3 || g.dy > 30) {
          Animated.timing(translateY, {
            toValue: heightRef.current + 40,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            onDismiss();
          });
          setFinishSetupDismissedAt(Date.now());
        }
      },
    })
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 0) heightRef.current = height;
  };

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateY }] }]}>
      <View
        onLayout={handleLayout}
        style={[
          styles.wrap,
          {
            backgroundColor: colors.surface ?? '#ffffff',
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 12,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.swipeHint}>
          <Text style={[styles.swipeText, { color: colors.textMuted }]}>↓ Swipe down to dismiss</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Finish your setup</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Add your hot tub details to unlock personalized shopping and recommendations.
        </Text>
        <View style={styles.row}>
          <TouchableOpacity
            onPress={onContinue}
            style={[styles.cta, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Continue setup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  wrap: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
  },
  swipeHint: {
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  swipeText: {
    fontSize: 11,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  cta: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
