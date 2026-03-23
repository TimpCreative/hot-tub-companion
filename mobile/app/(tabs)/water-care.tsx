import { View, Text, StyleSheet } from 'react-native';

export default function WaterCareScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Water Care</Text>
      <Text style={styles.body}>Water testing, guides, and maintenance — coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
  },
});
