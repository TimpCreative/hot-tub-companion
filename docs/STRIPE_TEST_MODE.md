# Stripe test checkout (simulate a subscription)

Use this when you want **fake money** and test cards (`4242 4242 4242 4242`). Everything must be **test mode** or **live mode** — never mix.

## The rule

| API env `STRIPE_SECRET_KEY` | Database must have |
|------------------------------|---------------------|
| `sk_test_…` | Test Connect account + **test** `price_…` ids on products |
| `sk_live_…` | Live Connect account + **live** `price_…` ids |

If you use `sk_test_…` but the DB still has **live** prices from before, Stripe returns an error (the API now responds with `STRIPE_MODE_MISMATCH` and explains the fix).

## Simplest path to test

### 1. Stripe Dashboard

- Turn **Test mode** ON (toggle top-right).

### 2. API environment (Railway or local)

Set:

- **`STRIPE_SECRET_KEY`** = **Secret key** from **Developers → API keys** while Test mode is on (`sk_test_…`).
- **`STRIPE_WEBHOOK_SECRET`** = signing secret from a **test** webhook endpoint (or `stripe listen` while developing locally).

### 3. Connect (retailer)

Complete **Stripe Connect** onboarding **in Test mode** for that store so the tenant has a **test** connected account. If the tenant row still has an old **live** connected account id, test checkout will not line up — complete Connect again in test or use a staging database.

### 4. Subscription prices in your DB

After keys + Connect are **test**:

- In **Retail Admin → Products**, for each product you want to subscribe to: turn **Subscription eligible** **off**, save, then **on** again (or use bulk), so the server **creates new test** `subscription_stripe_price_id` values.

Until those ids are recreated, old **live** `price_…` strings will still break test checkout.

### 5. Point the app at this API

The mobile app must call the **same** base URL that uses **`sk_test_…`** (e.g. staging API). If the app still hits production with **live** keys while your DB is mixed, you’ll get confusing errors.

### 6. Pay in Checkout

Use Stripe [test card](https://stripe.com/docs/testing) `4242 4242 4242 4242`, any future expiry, any CVC.

## Production

Use **`sk_live_…`**, live webhook secret, live Connect, and live prices. Do **not** point production customers at `sk_test_…`.
