import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity } from 'react-native';
import { useTenant } from '../../contexts/TenantContext';

const ACTIVE = '#1B4D7A';
const INACTIVE = '#8E8E93';

export default function TabLayout() {
  const router = useRouter();
  const { config } = useTenant();
  const hideInbox = config?.features?.tabInbox === false;
  const hideDealer = config?.features?.tabDealer === false;
  const primary = config?.branding?.primaryColor ?? ACTIVE;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: primary,
        tabBarInactiveTintColor: INACTIVE,
        headerShown: true,
        headerStyle: { backgroundColor: primary },
        headerTintColor: '#fff',
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
          headerShown: true,
          headerStyle: { backgroundColor: primary },
          headerTintColor: '#fff',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.replace('/(tabs)/water-care')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Back</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="maintenance-log"
        options={{
          title: 'Maintenance Log',
          href: null,
          headerShown: true,
          headerStyle: { backgroundColor: primary },
          headerTintColor: '#fff',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.replace('/(tabs)/water-care')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Back</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="water-guides"
        options={{
          title: 'Guides & Videos',
          href: null,
          headerShown: true,
          headerStyle: { backgroundColor: primary },
          headerTintColor: '#fff',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.replace('/(tabs)/water-care')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Back</Text>
            </TouchableOpacity>
          ),
        }}
      />
    </Tabs>
  );
}
