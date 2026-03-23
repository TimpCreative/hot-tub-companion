/**
 * Persists "setup skipped" for onboarding. Wraps AsyncStorage because on some
 * builds (native module not linked) AsyncStorage throws "Native module is null".
 * In-memory fallback keeps the app usable and avoids uncaught promise rejections.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SETUP_SKIPPED_KEY } from '../constants/setupStorage';

let memoryValue: string | null = null;

export async function getSetupSkippedFlag(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(SETUP_SKIPPED_KEY);
    memoryValue = v;
    return v === 'true';
  } catch {
    return memoryValue === 'true';
  }
}

export async function setSetupSkippedFlag(value: boolean): Promise<void> {
  if (value) {
    memoryValue = 'true';
    try {
      await AsyncStorage.setItem(SETUP_SKIPPED_KEY, 'true');
    } catch {
      // keep memoryValue for this session
    }
  } else {
    memoryValue = null;
    try {
      await AsyncStorage.removeItem(SETUP_SKIPPED_KEY);
    } catch {
      // memory already cleared
    }
  }
}

export async function clearSetupSkippedFlag(): Promise<void> {
  memoryValue = null;
  try {
    await AsyncStorage.removeItem(SETUP_SKIPPED_KEY);
  } catch {
    // memory already cleared
  }
}
