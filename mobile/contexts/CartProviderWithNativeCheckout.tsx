import React from 'react';
import { ShopifyCheckoutSheetProvider } from '@shopify/checkout-sheet-kit';
import { CartProviderCore } from './CartContext';
import { CartCheckoutNativeBridge } from './CartCheckoutNativeBridge';

/**
 * Loads Checkout Sheet Kit native bindings. Only import this module when
 * `isShopifyCheckoutKitNativeAvailable()` is true so we never evaluate the library
 * with a null native module.
 */
export function CartProviderWithNativeCheckout({ children }: { children: React.ReactNode }) {
  return (
    <ShopifyCheckoutSheetProvider>
      <CartCheckoutNativeBridge>{children}</CartCheckoutNativeBridge>
    </ShopifyCheckoutSheetProvider>
  );
}
