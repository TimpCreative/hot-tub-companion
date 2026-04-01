import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTenant } from '../../contexts/TenantContext';
import { buildAppStackHeaderOptions, buildReplacementBackButton } from '../../lib/appHeader';

const ACTIVE = '#1B4D7A';
const INACTIVE = '#8E8E93';

export default function TabLayout() {
  const { config } = useTenant();
  const hideInbox = config?.features?.tabInbox === false;
  const hideDealer = config?.features?.tabDealer === false;
  const primary = config?.branding?.primaryColor ?? ACTIVE;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: primary,
        tabBarInactiveTintColor: INACTIVE,
        ...buildAppStackHeaderOptions(primary),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => <Ionicons name="cart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="water-care"
        options={{
          title: 'Water Care',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="water-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          href: hideInbox ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="mail-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dealer"
        options={{
          title: 'Dealer',
          headerShown: false,
          href: hideDealer ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="water-test"
        options={{
          title: 'Water Test',
          href: null,
          headerLeft: buildReplacementBackButton('/(tabs)/water-care'),
        }}
      />
      <Tabs.Screen
        name="maintenance-log"
        options={{
          title: 'Maintenance Log',
          href: null,
          headerLeft: buildReplacementBackButton('/(tabs)/water-care'),
        }}
      />
      <Tabs.Screen
        name="water-guides"
        options={{
          title: 'Guides & Videos',
          href: null,
          headerLeft: buildReplacementBackButton('/(tabs)/water-care'),
        }}
      />
      <Tabs.Screen
        name="content/[id]"
        options={{
          title: 'Guide',
          href: null,
          headerLeft: buildReplacementBackButton('/(tabs)/water-guides'),
        }}
      />
    </Tabs>
  );
}
