import React, { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useShopifyCheckoutSheet } from '@shopify/checkout-sheet-kit';
import { CartProviderCore } from './CartContext';

/**
 * Must render under ShopifyCheckoutSheetProvider. Bridges the kit hook into CartProviderCore.
 */
export function CartCheckoutNativeBridge({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const checkoutSheet = useShopifyCheckoutSheet();

  const onCheckoutCompleted = useCallback(() => {
    router.push('/(tabs)/profile/orders/thanks');
  }, [router]);

  const presentCheckout = useCallback(
    (url: string) => {
      checkoutSheet.present(url);
    },
    [checkoutSheet]
  );

  const subscribeCheckoutCompleted = useCallback(
    (handler: () => void) => {
      const sub = checkoutSheet.addEventListener('completed', handler);
      return () => sub?.remove();
    },
    [checkoutSheet]
  );

  const subscribeCheckoutClosed = useCallback(
    (handler: () => void) => {
      const sub = checkoutSheet.addEventListener('close', handler);
      return () => sub?.remove();
    },
    [checkoutSheet]
  );

  const subscribeCheckoutError = useCallback(
    (handler: (err: { message?: string }) => void) => {
      const sub = checkoutSheet.addEventListener('error', handler);
      return () => sub?.remove();
    },
    [checkoutSheet]
  );

  const checkoutDeps = useMemo(
    () => ({
      presentCheckout,
      subscribeCheckoutCompleted,
      subscribeCheckoutClosed,
      subscribeCheckoutError,
      onCheckoutCompleted,
    }),
    [presentCheckout, subscribeCheckoutCompleted, subscribeCheckoutClosed, subscribeCheckoutError, onCheckoutCompleted]
  );

  return <CartProviderCore checkout={checkoutDeps}>{children}</CartProviderCore>;
}
