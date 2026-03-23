/**
 * Persists "welcome seen" for the one-time Welcome screen after first spa registration.
 * Wraps AsyncStorage because on some builds (native module not linked) AsyncStorage throws
 * "Native module is null". In-memory fallback keeps the app usable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WELCOME_SEEN_KEY } from '../constants/setupStorage';

let memoryValue: string | null = null;

export async function getWelcomeSeenFlag(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(WELCOME_SEEN_KEY);
    memoryValue = v;
    return v === 'true';
  } catch {
    return memoryValue === 'true';
  }
}

export async function setWelcomeSeenFlag(): Promise<void> {
  memoryValue = 'true';
  try {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, 'true');
  } catch {
    // keep memoryValue for this session
  }
}
