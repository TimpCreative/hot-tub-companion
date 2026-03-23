import AsyncStorage from '@react-native-async-storage/async-storage';
import { FINISH_SETUP_DISMISSED_AT_KEY } from '../constants/setupStorage';

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours (once a day) before banner shows again

export async function getFinishSetupDismissedAt(): Promise<number | null> {
  try {
    const v = await AsyncStorage.getItem(FINISH_SETUP_DISMISSED_AT_KEY);
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

export async function setFinishSetupDismissedAt(timestamp: number): Promise<void> {
  try {
    await AsyncStorage.setItem(FINISH_SETUP_DISMISSED_AT_KEY, String(timestamp));
  } catch {
    // ignore
  }
}

/** Returns true if banner should be suppressed (within cooldown). */
export async function isFinishSetupBannerSuppressed(): Promise<boolean> {
  const at = await getFinishSetupDismissedAt();
  if (!at) return false;
  return Date.now() - at < COOLDOWN_MS;
}
