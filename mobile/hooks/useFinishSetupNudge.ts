import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { getSetupSkippedFlag } from '../lib/setupSkippedStorage';

export function useFinishSetupNudge() {
  const [showNudge, setShowNudge] = useState(false);

  const refresh = useCallback(async () => {
    const skipped = await getSetupSkippedFlag();
    if (!skipped) {
      setShowNudge(false);
      return;
    }
    try {
      const res = (await api.get('/spa-profiles')) as { data?: { spaProfiles?: unknown[] } };
      const list = res?.data?.spaProfiles ?? [];
      setShowNudge(list.length === 0);
    } catch {
      setShowNudge(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { showNudge, refresh };
}
