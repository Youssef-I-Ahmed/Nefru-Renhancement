# NEFRU payments — Paymob

NEFRU uses the Paymob Intention API with Unified Checkout. Stripe is no longer part of the tourist checkout flow.

## Product rules

- One signed-in tourist account reserves exactly one place for the account holder.
- A booking holds one place for 15 minutes while payment is pending.
- The amount sent to Paymob is always the booking total in the booking currency.
- NEFRU currently stores trip prices in USD, so the configured Paymob Integration IDs must support USD.
- The browser redirect is UX only. A booking is confirmed only after the backend validates Paymob's HMAC-signed transaction callback.
- Raw card/wallet credentials are entered on Paymob and are never stored by NEFRU.

## Backend environment

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
BACKEND_PUBLIC_URL=https://your-public-backend.example.com
PAYMOB_BASE_URL=https://accept.paymob.com
PAYMOB_SECRET_KEY=...
PAYMOB_PUBLIC_KEY=...
PAYMOB_HMAC_SECRET=...
PAYMOB_INTEGRATION_IDS=123456,789012
PAYMOB_CURRENCY=USD
PAYMOB_CHECKOUT_EXPIRATION_SECONDS=900
```

`PAYMOB_WEBHOOK_URL` is optional. If omitted, NEFRU uses:

```text
${BACKEND_PUBLIC_URL}/api/payments/paymob/webhook
```

Never place the Secret Key or HMAC secret in the frontend environment.

If you enable non-card Integration IDs (for example mobile wallets), also set the same Transaction Processed Callback URL in those Paymob integration settings. Paymob documents the per-intention `notification_url` override specifically for card Integration IDs.

## Local webhook testing

Paymob must reach the backend over public HTTPS. Use an HTTPS tunnel, then set for example:

```env
BACKEND_PUBLIC_URL=https://your-tunnel.example.com
```

Restart the backend after changing `.env`.

## Tourist payment flow

1. Tourist chooses a date/time.
2. `POST /api/bookings` creates a 15-minute seat hold.
3. Checkout calls `POST /api/payments/checkout` with the booking ID.
4. Backend creates a Paymob Intention using the configured Integration IDs.
5. Frontend redirects to Paymob Unified Checkout.
6. Paymob redirects the browser back to the booking status page.
7. Separately, Paymob POSTs the transaction callback to `/api/payments/paymob/webhook`.
8. NEFRU verifies HMAC, amount, currency, and Integration ID before setting `paymentStatus=paid` and `status=confirmed`.
9. The returned browser page polls `GET /api/payments/:bookingId/status` until the verified webhook is processed.

## Main payment routes

```text
POST /api/payments/checkout
GET  /api/payments/:bookingId/status
POST /api/payments/paymob/webhook   # public, HMAC authenticated
```

## Test/live rule

Paymob Secret/Public Keys are mode-specific. Test keys must be paired with Test Integration IDs, and Live keys with Live Integration IDs.
