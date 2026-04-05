import React, { useCallback, useMemo } from 'react';
import { useShopifyCheckoutSheet } from '@shopify/checkout-sheet-kit';
import { CartProviderCore } from './CartContext';

/**
 * Must render under ShopifyCheckoutSheetProvider. Bridges the kit hook into CartProviderCore.
 */
export function CartCheckoutNativeBridge({ children }: { children: React.ReactNode }) {
  const checkoutSheet = useShopifyCheckoutSheet();

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

  const checkoutDeps = useMemo(
    () => ({ presentCheckout, subscribeCheckoutCompleted }),
    [presentCheckout, subscribeCheckoutCompleted]
  );

  return <CartProviderCore checkout={checkoutDeps}>{children}</CartProviderCore>;
}
