import { NativeModules } from 'react-native';

/**
 * Shopify's package uses `'ShopifyCheckoutSheetKit' in NativeModules`, but the value
 * can still be null — then `new NativeEventEmitter(null)` crashes. Only treat the kit
 * as available when the module reference is non-null.
 */
export function isShopifyCheckoutKitNativeAvailable(): boolean {
  const m = NativeModules.ShopifyCheckoutSheetKit;
  return m != null && typeof m === 'object';
}
