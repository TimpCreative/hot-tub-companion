import * as WebBrowser from 'expo-web-browser';

/**
 * Opens Stripe-hosted pages (Checkout, Billing Portal) in an in-app browser sheet
 * instead of handing off to the full external Safari app.
 */
export async function openStripeHostedUrl(url: string): Promise<void> {
  const trimmed = url?.trim();
  if (!trimmed) return;
  await WebBrowser.openBrowserAsync(trimmed, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    enableBarCollapsing: false,
  });
}
