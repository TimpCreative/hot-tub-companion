import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';

export function buildAppStackHeaderOptions(primary: string) {
  return {
    headerShown: true,
    headerStyle: { backgroundColor: primary },
    headerTintColor: '#fff',
    headerTitleStyle: { fontSize: 17, fontWeight: '600' as const },
    headerShadowVisible: false,
  };
}

export function buildReplacementBackButton(target: Href) {
  return () => (
    <TouchableOpacity
      onPress={() => router.replace(target)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      <Ionicons name="chevron-back" size={20} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Back</Text>
    </TouchableOpacity>
  );
}
