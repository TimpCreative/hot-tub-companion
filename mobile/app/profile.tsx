import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/** Redirects /profile to the Profile tab so deep links work. */
export default function ProfileRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)/profile');
  }, [router]);
  return null;
}
