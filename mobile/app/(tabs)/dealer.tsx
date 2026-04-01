import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPageHeader } from '../../components/AppPageHeader';
import { useTenant } from '../../contexts/TenantContext';
import type { DealerActionButton, DealerLatestItem, DealerServiceItem } from '../../contexts/TenantContext';
import { useTheme } from '../../theme/ThemeProvider';

const DEFAULT_DEALER_PAGE = {
  layout: { actionButtonsLayout: 'grid_2x2' as const },
  dealerInfo: {
    showName: true,
    showAddress: true,
    showPhone: true,
    showEmail: true,
    showHours: true,
  },
  actionButtons: [
    { id: 'call_now', enabled: true, label: 'Call Now', iconKey: 'call-outline', actionType: 'call', order: 0 },
    { id: 'directions', enabled: true, label: 'Directions', iconKey: 'navigate-outline', actionType: 'directions', order: 1 },
    { id: 'message', enabled: true, label: 'Message', iconKey: 'chatbubble-outline', actionType: 'message', order: 2 },
    { id: 'book_service', enabled: true, label: 'Book Service', iconKey: 'calendar-outline', actionType: 'book_service', order: 3 },
  ] as DealerActionButton[],
  servicesBlock: {
    enabled: true,
    title: 'Services We Offer',
    subtitle: 'Everything you need for your hot tub',
    items: [
      { id: 'water_testing', enabled: true, title: 'Water Testing', body: 'Free in-store water analysis', iconKey: 'water-outline', order: 0 },
      { id: 'repairs_service', enabled: true, title: 'Repairs & Service', body: 'Professional maintenance', iconKey: 'build-outline', order: 1 },
      { id: 'parts_accessories', enabled: true, title: 'Parts & Accessories', body: 'Genuine OEM parts in stock', iconKey: 'construct-outline', order: 2 },
      { id: 'consultation', enabled: true, title: 'Consultation', body: 'Expert advice and support', iconKey: 'chatbubble-ellipses-outline', order: 3 },
    ] as DealerServiceItem[],
  },
  assistanceBlock: {
    enabled: true,
    title: 'Need Assistance?',
    body: 'Your dealer team is ready to help with your hot tub.',
    buttonLabel: 'Start a Conversation',
    actionType: 'chat' as const,
    actionValue: null,
  },
  latestBlock: {
    enabled: true,
    title: 'Latest from Your Dealer',
    subtitle: 'Updates and tips for your hot tub',
    items: [
      { id: 'latest_1', enabled: true, title: 'Spring Service Special', body: 'Schedule your seasonal maintenance and save 10%.', accentColor: '#0ea5e9', order: 0 },
      { id: 'latest_2', enabled: true, title: 'Filter Sale This Month', body: '20% off all replacement filters while supplies last.', accentColor: '#2563eb', order: 1 },
      { id: 'latest_3', enabled: true, title: 'New Water Care Products', body: 'Stop by to see our newest chemicals and accessories.', accentColor: '#14b8a6', order: 2 },
    ] as DealerLatestItem[],
  },
};

function sortByOrder<T extends { order: number }>(items: T[]) {
  return [...items].sort((a, b) => a.order - b.order);
}

function buildMapsUrl(address: string) {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
}

export default function DealerScreen() {
  const { config } = useTenant();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const name = config?.name ?? 'Your retailer';
  const dealerContact = config?.dealerContact;
  const dealerPage = config?.dealerPage ?? DEFAULT_DEALER_PAGE;
  const phone = dealerContact?.phone ?? null;
  const address = dealerContact?.address ?? null;
  const email = dealerContact?.email ?? null;
  const hours = dealerContact?.hours ?? null;

  async function handleAction(action: {
    actionType: string;
    actionValue?: string | null;
  }) {
    switch (action.actionType) {
      case 'call':
        if (phone) await Linking.openURL(`tel:${phone}`);
        break;
      case 'directions':
        if (action.actionValue) await Linking.openURL(action.actionValue);
        else if (address) await Linking.openURL(buildMapsUrl(address));
        break;
      case 'message':
        if (phone) await Linking.openURL(`sms:${phone}`);
        else if (email) await Linking.openURL(`mailto:${email}`);
        else if (config?.features?.tabInbox !== false) router.push('/inbox');
        break;
      case 'book_service':
        if (action.actionValue) await Linking.openURL(action.actionValue);
        else router.push('/services');
        break;
      case 'chat':
        if (config?.features?.tabInbox !== false) router.push('/inbox');
        else if (phone) await Linking.openURL(`tel:${phone}`);
        break;
      case 'external_url':
        if (action.actionValue) await Linking.openURL(action.actionValue);
        break;
      default:
        break;
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <AppPageHeader title={name} subtitle="Your trusted hot tub care partner" />

        <View style={[styles.card, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}>
          {dealerPage.dealerInfo.showName ? <Text style={[styles.dealerName, { color: colors.text }]}>{name}</Text> : null}
          <View style={styles.infoList}>
            {dealerPage.dealerInfo.showAddress && address ? (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={colors.primary} />
                <View style={styles.infoCopy}>
                  <Text style={[styles.infoLabel, { color: colors.text }]}>Address</Text>
                  <Text style={[styles.infoBody, { color: colors.textSecondary }]}>{address}</Text>
                </View>
              </View>
            ) : null}
            {dealerPage.dealerInfo.showPhone && phone ? (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={18} color={colors.primary} />
                <View style={styles.infoCopy}>
                  <Text style={[styles.infoLabel, { color: colors.text }]}>Phone</Text>
                  <Text style={[styles.infoBody, { color: colors.textSecondary }]}>{phone}</Text>
                </View>
              </View>
            ) : null}
            {dealerPage.dealerInfo.showEmail && email ? (
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={18} color={colors.primary} />
                <View style={styles.infoCopy}>
                  <Text style={[styles.infoLabel, { color: colors.text }]}>Email</Text>
                  <Text style={[styles.infoBody, { color: colors.textSecondary }]}>{email}</Text>
                </View>
              </View>
            ) : null}
            {dealerPage.dealerInfo.showHours && hours ? (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <View style={styles.infoCopy}>
                  <Text style={[styles.infoLabel, { color: colors.text }]}>Hours</Text>
                  <Text style={[styles.infoBody, { color: colors.textSecondary }]}>{hours}</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={dealerPage.layout.actionButtonsLayout === 'single' ? styles.singleActionList : styles.actionGrid}>
            {sortByOrder(dealerPage.actionButtons)
              .filter((button) => button.enabled)
              .map((button, index) => {
                const filled = index === 0;
                return (
                  <Pressable
                    key={button.id}
                    style={({ pressed }) => [
                      styles.actionButton,
                      {
                        backgroundColor: filled ? colors.primary : 'transparent',
                        borderColor: colors.primary,
                        opacity: pressed ? 0.92 : 1,
                      },
                    ]}
                    onPress={() => void handleAction(button)}
                  >
                    <Ionicons
                      name={button.iconKey as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={filled ? '#fff' : colors.primary}
                    />
                    <Text style={[styles.actionText, { color: filled ? '#fff' : colors.primary }]}>{button.label}</Text>
                  </Pressable>
                );
              })}
          </View>
        </View>

        {dealerPage.servicesBlock.enabled ? (
          <View style={[styles.card, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{dealerPage.servicesBlock.title}</Text>
            {dealerPage.servicesBlock.subtitle ? (
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{dealerPage.servicesBlock.subtitle}</Text>
            ) : null}
            <View style={styles.servicesGrid}>
              {sortByOrder(dealerPage.servicesBlock.items)
                .filter((item) => item.enabled)
                .map((item) => (
                  <View key={item.id} style={[styles.serviceCard, { backgroundColor: '#eff6ff' }]}>
                    <Ionicons name={item.iconKey as keyof typeof Ionicons.glyphMap} size={26} color={colors.primary} />
                    <Text style={[styles.serviceTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.serviceBody, { color: colors.textSecondary }]}>{item.body}</Text>
                  </View>
                ))}
            </View>
          </View>
        ) : null}

        {dealerPage.assistanceBlock.enabled ? (
          <View style={[styles.card, styles.assistanceCard]}>
            <Text style={styles.assistanceTitle}>{dealerPage.assistanceBlock.title}</Text>
            <Text style={[styles.assistanceBody, { color: colors.textSecondary }]}>{dealerPage.assistanceBlock.body}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.assistanceButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.92 : 1 },
              ]}
              onPress={() => void handleAction(dealerPage.assistanceBlock)}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#fff" />
              <Text style={styles.assistanceButtonText}>{dealerPage.assistanceBlock.buttonLabel}</Text>
            </Pressable>
          </View>
        ) : null}

        {dealerPage.latestBlock.enabled ? (
          <View style={[styles.card, { backgroundColor: colors.contentBackground, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{dealerPage.latestBlock.title}</Text>
            {dealerPage.latestBlock.subtitle ? (
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{dealerPage.latestBlock.subtitle}</Text>
            ) : null}
            <View style={styles.latestList}>
              {sortByOrder(dealerPage.latestBlock.items)
                .filter((item) => item.enabled)
                .map((item) => (
                  <View key={item.id} style={styles.latestItem}>
                    <View style={[styles.latestAccent, { backgroundColor: item.accentColor ?? colors.primary }]} />
                    <View style={styles.latestCopy}>
                      <Text style={[styles.latestTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.latestBody, { color: colors.textSecondary }]}>{item.body}</Text>
                    </View>
                  </View>
                ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 24, gap: 16 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  dealerName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoList: {
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionGrid: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  singleActionList: {
    marginTop: 18,
    gap: 12,
  },
  actionButton: {
    minWidth: '47%',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
    marginBottom: 16,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  serviceCard: {
    width: '47%',
    borderRadius: 16,
    padding: 16,
    minHeight: 164,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
  },
  serviceBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  assistanceCard: {
    borderColor: '#7dd3fc',
    backgroundColor: '#ecfeff',
    alignItems: 'center',
  },
  assistanceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#164e63',
  },
  assistanceBody: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
    textAlign: 'center',
  },
  assistanceButton: {
    marginTop: 18,
    alignSelf: 'stretch',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  assistanceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  latestList: {
    marginTop: 16,
    gap: 14,
  },
  latestItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  latestAccent: {
    width: 3,
    borderRadius: 999,
  },
  latestCopy: {
    flex: 1,
  },
  latestTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  latestBody: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
});
