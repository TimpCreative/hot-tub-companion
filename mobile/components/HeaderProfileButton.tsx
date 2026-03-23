import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Props = { tint?: 'light' | 'default' };

export function HeaderProfileButton({ tint = 'default' }: Props) {
  const router = useRouter();
  const color = tint === 'light' ? '#fff' : '#1B4D7A';
  return (
    <Pressable
      onPress={() => router.push('/profile')}
      style={styles.hit}
      accessibilityRole="button"
      accessibilityLabel="Profile"
    >
      <Ionicons name="person-circle-outline" size={26} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 4,
  },
});
