import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export default function WaterGuidesScreen() {
  const { colors } = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Guides & Videos</Text>
      <View style={[styles.card, { backgroundColor: colors.contentBackground }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Coming soon</Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          This screen is ready for curated water care guides and training videos. The Water Care tab now routes here instead of showing only an alert.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  card: { borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  copy: { fontSize: 15, lineHeight: 22 },
});
