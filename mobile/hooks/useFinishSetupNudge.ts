import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { isFinishSetupBannerSuppressed } from '../lib/finishSetupDismissStorage';
import { getSetupSkippedFlag } from '../lib/setupSkippedStorage';

export function useFinishSetupNudge() {
  const [showNudge, setShowNudge] = useState(false);

  const refresh = useCallback(async () => {
    const skipped = await getSetupSkippedFlag();
    if (!skipped) {
      setShowNudge(false);
      return;
    }
    const suppressed = await isFinishSetupBannerSuppressed();
    if (suppressed) {
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

  const dismiss = useCallback(() => {
    setShowNudge(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { showNudge, refresh, dismiss };
}
