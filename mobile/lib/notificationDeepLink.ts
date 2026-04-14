/**
 * Shared deep-link navigation from push / notification feed payload (linkType + linkId).
 */

import type { Router } from 'expo-router';
import { Linking } from 'react-native';

export function navigateFromNotificationPayload(
  router: Router,
  payload: Record<string, unknown> | null | undefined
): void {
  if (!payload?.linkType || !router) return;
  const linkType = String(payload.linkType);
  const linkId = payload.linkId != null ? String(payload.linkId) : '';

  switch (linkType) {
    case 'shop':
      router.push('/(tabs)/shop');
      break;
    case 'product':
      router.push(
        linkId ? (`/(tabs)/shop/${encodeURIComponent(linkId)}` as const) : '/(tabs)/shop'
      );
      break;
    case 'inbox':
      router.push('/(tabs)/inbox');
      break;
    case 'dealer':
      router.push('/(tabs)/dealer');
      break;
    case 'services':
      router.push('/services');
      break;
    case 'home':
      router.push('/(tabs)/home');
      break;
    case 'order':
      router.push('/(tabs)/profile/orders');
      break;
    case 'custom_url':
      if (linkId && /^https?:\/\//i.test(linkId)) {
        void Linking.openURL(linkId);
      }
      break;
    case 'maintenance_event':
      router.push(
        linkId
          ? (`/(tabs)/maintenance-timeline?eventId=${encodeURIComponent(linkId)}` as const)
          : '/(tabs)/maintenance-timeline'
      );
      break;
    default:
      break;
  }
}
