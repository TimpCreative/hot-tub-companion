import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading }: ButtonProps) {
  const { colors } = useTheme();
  const bgColor = variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.secondary : 'transparent';
  const textColor = variant === 'outline' ? colors.primary : '#fff';
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: bgColor, borderColor: colors.primary },
        isDisabled && { opacity: 0.5 },
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={isDisabled ? 1 : undefined}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
