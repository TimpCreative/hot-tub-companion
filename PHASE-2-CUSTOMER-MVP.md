# Phase 2 — Customer App MVP

**Depends on:** Phase 0 (app shell, auth), Phase 1 (products synced, UHTD populated)
**Unlocks:** Phase 3 (engagement features layer on top of this)
**Estimated effort:** 3–4 weeks

---

## Manual Steps Required (Do These First)

1. **Obtain TAB's branding package.** Collect from Take A Break: primary logo (SVG/PNG, light and dark background versions), brand colors (hex codes), preferred font (or approve a suggestion), app icon artwork, splash screen artwork. Place these in `/mobile/tenants/takeabreak/`.

2. **Set up Shopify Checkout Kit.** In TAB's Shopify admin, ensure Checkout is configured and the Storefront API scopes include `unauthenticated_read_checkouts` and `unauthenticated_write_checkouts`. The Checkout Kit requires the Storefront API access token (already obtained in Phase 1).

3. **Create test customer accounts.** Register 3–5 test accounts with different spa models and sanitization systems to fully test the personalized experience.

4. **Confirm at least 10 products are mapped in UHTD** for the test spa models so the compatibility-filtered product feed has real data to display.

---

## What Phase 2 Builds

At the end of this phase, you should have a fully functional customer-facing app where a user can:
- Register and log in
- Register their spa (brand, model line, model, year, sanitization system, serial number)
- See a personalized "My Tub" dashboard
- Browse products filtered to their spa's compatibility
- Add products to cart and complete checkout via Shopify Checkout Kit
- Receive basic push notifications (order confirmation, welcome)

This is the **minimum viable product** for customer-facing functionality.

---

## Part 1: Onboarding Flow

### 1.1 Registration Screen

`/auth/register`

**Fields:**
- First Name (required)
- Last Name (required)
- Email (required, validated)
- Password (required, min 8 chars, show/hide toggle)
- Phone Number (optional, formatted input)

**On submit:**
1. Call `POST /api/v1/auth/register`
2. On success, navigate to spa registration onboarding

**Design notes:**
- Show retailer's logo at top of screen (from tenant config)
- Use retailer's primary color for the "Create Account" button
- Link to "Already have an account? Sign In" at bottom

### 1.2 Spa Registration Flow

This is a multi-step wizard. The user must complete this before accessing the main app. The registration system should be **easily extensible** — built so that adding new fields later requires minimal code changes.

**Step 1: Select Brand**
- Grid of brand logos/names from `GET /api/v1/uhtd/brands`
- Tappable cards, visually distinct selection state
- "I don't know my brand" link → shows message: "Contact [Retailer Name] at [phone/email] and they can help you identify your spa." with a "Send Email" button that opens the email client pre-filled with the retailer's support email.

**Step 2: Select Model Line**
- Fetches from `GET /api/v1/uhtd/brands/:brandId/model-lines`
- List view with model line names and descriptions
- Back button to return to brand selection

**Step 3: Select Model**
- Fetches from `GET /api/v1/uhtd/model-lines/:modelLineId/models`
- List view showing model name, image thumbnail (if available), discontinued badge
- Shows key specs inline: seating capacity, jet count

**Step 4: Select Year**
- Fetches from `GET /api/v1/uhtd/models/:modelId/years`
- Simple scrollable picker or grid of year buttons
- Most recent year pre-selected

**Step 5: Select Sanitization System**
- Five options displayed as cards with icons and brief descriptions:
  - **Bromine** — "Tablet or granular bromine-based sanitization"
  - **Chlorine** — "Granular dichlor or liquid chlorine"
  - **Frog @Ease** — "SmartChlor mineral cartridge system"
  - **Copper** — "Copper ionizer-based sanitization"
  - **Silver/Mineral Stick** — "Silver ion mineral purifier stick"
- "Not sure which system you use?" link → "Contact [Retailer Name] to find out. You'll need to select a system before you can shop for chemicals." + phone and email buttons
- This selection is critical — it filters all chemical recommendations

**Step 6: Serial Number & Usage (optional, skippable)**
- Serial number text input: "You can find this on a sticker on your spa's equipment compartment"
- Seasonal usage: "Which months do you plan to use your tub?" — 12 month toggle buttons, all ON by default. User can toggle off months they winterize.
- "Skip for now" button — these can be added later in profile settings

**Step 7: Confirmation**
- Summary of all selections: "Your [Brand] [Model] ([Year]) with [Sanitization System]"
- "This looks right" button → calls `POST /api/v1/spa-profiles` → navigates to Welcome screen
- "Let me change something" → goes back to relevant step

### 1.3 Welcome Screen

Brief welcome with retailer branding:
- "Welcome to [Retailer Name], [First Name]!"
- 3 quick value propositions with icons:
  - "🛒 Shop products made for your [Model Name]"
  - "🔧 Schedule service with a tap"
  - "💧 Track your water care"
- "Get Started" button → navigates to main app (tabs)

### 1.4 Spa Registration API

```
POST /api/v1/spa-profiles
  Body: {
    brand: "Jacuzzi",
    modelLine: "J-300 Collection",
    model: "J-335",
    year: 2023,
    sanitizationSystem: "bromine",
    serialNumber: "JAC-335-2023-001234",  // optional
    usageMonths: [1,2,3,4,5,6,7,8,9,10,11,12],  // optional
    uhtdSpaModelId: "uuid-of-matched-model"  // from UHTD selection
  }
  → Returns: created spa profile with ID

GET /api/v1/spa-profiles
  → Returns: all spa profiles for current user (supports multiple spas)

PUT /api/v1/spa-profiles/:id
  → Update spa profile (change sanitization, usage months, serial number, etc.)

DELETE /api/v1/spa-profiles/:id
  → Delete a spa profile (confirm dialog in app)
```

---

## Part 2: Main App Navigation

### 2.1 Tab Bar Layout

After onboarding, the app uses a bottom tab bar with 4 tabs:

| Tab | Icon | Label | Screen |
|-----|------|-------|--------|
| 1 | 🏠 Home icon | Home | My Tub Dashboard |
| 2 | 🛒 Shopping bag | Shop | Product Browsing |
| 3 | 🔧 Wrench | Services | Service Requests (placeholder in Phase 2, built in Phase 4) |
| 4 | 👤 Person | Profile | Account Settings |

The tab bar uses the retailer's primary color for the active tab indicator.

### 2.2 Spa Selector (Global)

If the user has multiple spas, a spa selector appears in the header of the Home and Shop tabs. It's a dropdown/pill that shows the active spa's nickname or model name. Tapping it lets the user switch between spas. The selected spa determines what products are shown in Shop and what data displays on the Dashboard.

Store the active spa profile ID in local state (React context) and persist it to `AsyncStorage` so it survives app restarts.

---

## Part 3: My Tub Dashboard (Home Tab)

### 3.1 Dashboard Layout

The home screen shows a personalized overview for the active spa:

**Header section:**
- Spa model image (from UHTD, or a generic hot tub silhouette if no image)
- "[Brand] [Model]" title
- "[Year] • [Sanitization System]" subtitle
- Serial number (if entered)

**Quick Actions row (horizontal scroll):**
- "Shop Supplies" → navigates to Shop tab
- "Schedule Service" → navigates to Services tab (placeholder in Phase 2)
- "Test Water" → navigates to Water Care (placeholder, built in Phase 3)
- "My Subscriptions" → navigates to Subscriptions (placeholder, built in Phase 3)

**Info Cards (vertical scroll below quick actions):**

1. **Warranty Card** (if warranty expiration date is set)
   - "Warranty Status"
   - Green "Active" badge or red "Expired" badge
   - "Expires: [date]"

2. **Filter Reminder Card**
   - "Last Filter Change: [date]" or "No filter change recorded"
   - "Tap to log a filter change"
   - When tapped, updates `spa_profiles.last_filter_change` to today

3. **Seasonal Alert Card** (conditional)
   - Shows only when a seasonal transition is approaching
   - If current month + 1 is NOT in `usage_months`: "Time to winterize! [Shop winterizing supplies]"
   - If current month - 1 was NOT in `usage_months` but current month IS: "Getting ready for spa season! [Shop startup supplies]"

4. **Recent Orders Card** (if any orders exist — placeholder until checkout is built)
   - Shows last 2 orders with status

---

## Part 4: Product Browsing (Shop Tab)

### 4.1 Shop Screen Layout

**Top section:**
- Search bar (searches product titles and descriptions locally on the fetched data)
- Category filter pills (horizontal scroll): "All", "Filters", "Chemicals", "Covers", "Accessories", etc. — derived from UHTD part categories that have mapped products

**Product grid:**
- 2-column grid of product cards
- Each card shows: product image, product title (truncated), price, "Add to Cart" button
- If inventory_quantity = 0, show "Out of Stock" overlay and disable Add to Cart
- Infinite scroll pagination (20 products per page)

**Two viewing modes:**

1. **"For Your [Model]" (default)** — shows only products compatible with the active spa via UHTD mapping. Uses `GET /api/v1/products/compatible/:spaProfileId`

2. **"Browse All"** — shows all non-hidden products from the retailer. Toggle between modes with a switch/segmented control at top.

### 4.2 Product Detail Screen

When tapping a product card, navigate to a full product detail screen:

- Product image carousel (swipeable, supports multiple images)
- Product title
- Price (formatted: "$29.99")
- Compare-at price with strikethrough if applicable
- Inventory status: "In Stock" (green) or "X left" (orange) or "Out of Stock" (red)
- Product description (rendered from HTML/markdown if applicable)
- Variant selector (if product has variants — e.g., size options for chemicals)
- Quantity selector (default 1, increment/decrement)
- "Add to Cart" button (full width, retailer primary color)
- Compatibility badge: "✓ Compatible with your [Model]" or "ℹ️ General product — check compatibility"
- Related products section at bottom (other compatible products in same category)

### 4.3 Cart

**Cart icon** in the header with badge count showing number of items.

**Cart screen (modal or dedicated screen):**
- List of cart items: image, title, variant, quantity, price, line total
- Quantity adjustable per item (increment/decrement)
- Remove item (swipe-to-delete or X button)
- Subtotal displayed at bottom
- "Proceed to Checkout" button

**Cart state management:**
- Use React Context (`CartContext`)
- Cart is backed by Shopify Storefront API cart objects
- On "Add to Cart": call Shopify Storefront API `cartCreate` mutation (if no cart exists) or `cartLinesAdd` mutation
- Cart ID stored in SecureStore so it persists across sessions
- Cart is tied to the retailer's Shopify store

### 4.4 Checkout via Shopify Checkout Kit

When the user taps "Proceed to Checkout":

1. Retrieve the `checkoutUrl` from the Shopify cart object
2. Call `shopifyCheckout.present(checkoutUrl)` from `@shopify/checkout-sheet-kit`
3. Shopify Checkout Kit presents a native checkout sheet over the app
4. The checkout sheet is fully branded per the retailer's Shopify checkout customization
5. Customer enters shipping info, selects shipping method, enters payment, and completes purchase — all within Shopify's UI
6. Listen for checkout completion events:
   - `completed`: Order placed successfully → show success screen, clear cart, log order reference
   - `cancelled`: User dismissed checkout → return to cart
   - `failed`: Payment failed → show error, return to cart

**Implementation:**

```typescript
import { useShopifyCheckoutSheet } from '@shopify/checkout-sheet-kit';

function CheckoutButton({ checkoutUrl }) {
  const shopifyCheckout = useShopifyCheckoutSheet();

  // Preload for faster presentation
  useEffect(() => {
    if (checkoutUrl) {
      shopifyCheckout.preload(checkoutUrl);
    }
  }, [checkoutUrl]);

  const handleCheckout = () => {
    shopifyCheckout.present(checkoutUrl);
  };

  // Listen for events
  useEffect(() => {
    const unsubscribeComplete = shopifyCheckout.addEventListener('completed', (event) => {
      // Order completed — clear cart, navigate to confirmation
      clearCart();
      navigation.navigate('OrderConfirmation', { orderId: event.orderDetails?.id });
    });

    const unsubscribeCancel = shopifyCheckout.addEventListener('cancelled', () => {
      // User cancelled — stay on cart
    });

    return () => {
      unsubscribeComplete();
      unsubscribeCancel();
    };
  }, []);

  return <Button onPress={handleCheckout} title="Proceed to Checkout" />;
}
```

**For Lightspeed retailers (no Shopify):**
This is an edge case we need to address. If a retailer uses Lightspeed but not Shopify, we have two options:
- Option A: Require the retailer to also set up a minimal Shopify store just for checkout. We sync products from Lightspeed but checkout through Shopify.
- Option B: Use a WebView to load the retailer's existing e-commerce website checkout. Less native feel but avoids requiring Shopify.
- **Decision for now:** Start with Option A for TAB (they may already have Shopify, or we set one up). Revisit for future retailers.

### 4.5 Shopify Storefront API Integration

```typescript
// services/shopify-storefront.ts
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import Constants from 'expo-constants';

const client = new ApolloClient({
  uri: `https://${SHOPIFY_STORE_URL}/api/2025-01/graphql.json`,
  cache: new InMemoryCache(),
  headers: {
    'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
  },
});

// Cart mutations
const CREATE_CART = gql`
  mutation CreateCart($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart { id checkoutUrl lines(first: 100) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } product { title images(first: 1) { edges { node { url } } } } } } } } } }
    }
  }
`;

const ADD_TO_CART = gql`
  mutation AddToCart($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { id checkoutUrl lines(first: 100) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } } } } } } }
    }
  }
`;

const UPDATE_CART = gql`
  mutation UpdateCart($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { id checkoutUrl lines(first: 100) { edges { node { id quantity } } } }
    }
  }
`;

const REMOVE_FROM_CART = gql`
  mutation RemoveFromCart($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { id checkoutUrl lines(first: 100) { edges { node { id quantity } } } }
    }
  }
`;
```

**Important:** The `merchandiseId` used in cart mutations is the Shopify **Storefront** variant ID (a GID like `gid://shopify/ProductVariant/12345`). You need to store the mapping between your `pos_products.pos_variant_id` (Admin API ID) and the Storefront variant GID. You can either:
- Convert Admin IDs to Storefront GIDs using the formula: `gid://shopify/ProductVariant/{numericId}`
- Or fetch products via Storefront API to get the correct GIDs

---

## Part 5: Push Notifications (Basic)

### 5.1 FCM Setup

On app launch (after auth), request notification permissions and register the FCM token:

```typescript
import * as Notifications from 'expo-notifications';

async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  // Or use FCM directly:
  // const token = (await Notifications.getDevicePushTokenAsync()).data;

  // Send token to backend
  await api.put('/users/me/fcm-token', { fcmToken: token });
}
```

### 5.2 Backend Notification Service

```typescript
// services/notification.service.ts
import * as admin from 'firebase-admin';

async function sendPushNotification(userId: string, title: string, body: string, data?: object) {
  const user = await getUserById(userId);
  if (!user.fcm_token) return;

  // Check user's notification preferences
  // ... check relevant notification_pref_* field

  await admin.messaging().send({
    token: user.fcm_token,
    notification: { title, body },
    data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
  });

  // Log notification in database
  await db('notifications').insert({
    tenant_id: user.tenant_id,
    user_id: user.id,
    title,
    body,
    type: data?.type || 'general',
    sent_at: new Date(),
  });
}
```

### 5.3 Phase 2 Notifications

Only basic notifications in this phase:
- **Welcome notification:** Sent after registration: "Welcome to [Retailer Name]! Your [Model] is all set up. 🎉"
- **Order confirmation:** Sent when Shopify webhook fires for order creation (requires webhook setup — see below)

### 5.4 Shopify Webhooks

Register Shopify webhooks to get notified of order events:

```
POST /admin/api/2025-01/webhooks.json
{
  "webhook": {
    "topic": "orders/create",
    "address": "https://api.hottubcompanion.com/api/v1/webhooks/shopify/orders",
    "format": "json"
  }
}
```

**Webhook handler endpoint:** `POST /api/v1/webhooks/shopify/orders`
- Verify webhook signature using Shopify's HMAC validation
- Extract order data, match to tenant via Shopify store URL
- Try to match customer email to a user in our database
- If matched: send push notification "Your order #[number] has been placed! 🛒"
- Store order reference in a simple `order_references` table for display on dashboard

---

## Part 6: Profile & Settings (Profile Tab)

### 6.1 Profile Screen

- **Account section:** Name, email, phone, address (editable)
- **My Spas section:** List of registered spas with edit/delete. "Add Another Spa" button.
- **Notification Preferences:** Toggle switches for each notification category (maintenance, orders, subscriptions, service, promotional)
- **Privacy:** Toggle for "Share water test data with [Retailer Name]"
- **App Info:** Version number, terms of service link, privacy policy link
- **Sign Out** button
- **Delete Account** button (with confirmation dialog)

### 6.2 Edit Spa Flow

Tapping a spa in the profile opens an edit screen where the user can change:
- Sanitization system (with warning: "Changing your sanitization system will update your product recommendations")
- Usage months
- Serial number
- Nickname
- Warranty expiration date
- The user CANNOT change brand/model/year inline — they would need to delete and re-register if the spa was entered wrong

---

## Verification Checklist

Before moving to Phase 3, verify:

- [ ] New user can register, complete spa onboarding, and land on My Tub dashboard
- [ ] Spa registration correctly links to UHTD model
- [ ] My Tub dashboard shows correct spa info, warranty status, filter reminder
- [ ] Seasonal alerts appear at appropriate times
- [ ] Shop tab shows products filtered to the user's spa model
- [ ] Shop tab filters further by sanitization system for chemicals
- [ ] "Browse All" mode shows all non-hidden products
- [ ] Category filter pills work correctly
- [ ] Product search works
- [ ] Product detail screen shows full info with images, variants, pricing
- [ ] Add to Cart creates/updates a Shopify cart
- [ ] Cart screen shows items, allows quantity changes and removal
- [ ] Checkout via Shopify Checkout Kit works end-to-end (test purchase)
- [ ] Order webhook fires and creates a notification
- [ ] Push notifications are received on device
- [ ] User with multiple spas can switch between them
- [ ] Profile settings are editable and persist
- [ ] Spa profile can be edited (sanitization, usage months, serial number)
- [ ] App displays correctly with TAB's branding (colors, logo, fonts)
- [ ] App works on both iOS and Android
