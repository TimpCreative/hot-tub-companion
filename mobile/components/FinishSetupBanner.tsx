import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  onContinue: () => void;
};

export function FinishSetupBanner({ onContinue }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { borderColor: colors.primary, backgroundColor: `${colors.primary}12` }]}>
      <Text style={[styles.title, { color: colors.text }]}>Finish your setup</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        Add your hot tub details to unlock personalized shopping and recommendations.
      </Text>
      <TouchableOpacity onPress={onContinue} accessibilityRole="button">
        <Text style={[styles.cta, { color: colors.primary }]}>Continue setup</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  cta: {
    fontSize: 14,
    fontWeight: '600',
  },
});
