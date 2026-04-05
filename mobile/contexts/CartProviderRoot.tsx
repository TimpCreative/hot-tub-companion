import React from 'react';
import * as Linking from 'expo-linking';
import { CartProviderCore } from './CartContext';
import { isShopifyCheckoutKitNativeAvailable } from '../lib/shopifyCheckoutNative';

const linkingCheckout = {
  presentCheckout: (url: string) => {
    void Linking.openURL(url);
  },
  subscribeCheckoutCompleted: () => () => {},
};

/**
 * Uses Checkout Sheet Kit only when the native module is non-null. Otherwise opens
 * checkout in the system browser (avoids `NativeEventEmitter` crash when the key exists
 * but the native object is null).
 */
export function CartProviderRoot({ children }: { children: React.ReactNode }) {
  if (!isShopifyCheckoutKitNativeAvailable()) {
    return <CartProviderCore checkout={linkingCheckout}>{children}</CartProviderCore>;
  }

  const { CartProviderWithNativeCheckout } = require('./CartProviderWithNativeCheckout') as {
    CartProviderWithNativeCheckout: React.ComponentType<{ children: React.ReactNode }>;
  };
  return <CartProviderWithNativeCheckout>{children}</CartProviderWithNativeCheckout>;
}
