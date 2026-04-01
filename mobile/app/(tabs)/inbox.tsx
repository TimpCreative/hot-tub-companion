import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPageHeader } from '../../components/AppPageHeader';
import { useTheme } from '../../theme/ThemeProvider';

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <AppPageHeader title="Inbox" subtitle="Messages and updates from your retailer." />
        <Text style={[styles.body, { color: colors.textSecondary }]}>Messages and updates — coming soon.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 24 },
  body: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
  },
});
