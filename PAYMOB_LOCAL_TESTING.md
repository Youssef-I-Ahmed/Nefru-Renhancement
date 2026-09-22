# NEFRU — Paymob local testing checklist

This patch supports two Paymob checkout modes:

- `pixel` (recommended): Paymob's secure card component is embedded inside the NEFRU checkout page.
- `redirect`: fallback to Paymob Unified Checkout.

NEFRU never stores a full card number or CVV. Saved cards use Paymob card tokens; the token is encrypted server-side before it is stored.

## 1. Backend environment

Keep the real values in `backend/.env` only:

```env
PAYMOB_BASE_URL=https://accept.paymob.com
PAYMOB_SECRET_KEY=...
PAYMOB_PUBLIC_KEY=...
PAYMOB_HMAC_SECRET=...
PAYMOB_API_KEY=...
PAYMOB_INTEGRATION_IDS=YOUR_TEST_EGP_INTEGRATION_ID
PAYMOB_CURRENCY=EGP
PAYMOB_CHECKOUT_MODE=pixel
PAYMOB_CHECKOUT_EXPIRATION_SECONDS=900
```

Create one stable encryption key for saved-card tokens:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output into:

```env
PAYMENT_TOKEN_ENCRYPTION_KEY=...
```

Do not rotate that encryption key casually after users have saved cards. Existing encrypted Paymob tokens cannot be decrypted with a different key.

## 2. Local payment confirmation without a tunnel

`PAYMOB_API_KEY` enables the backend Transaction Inquiry fallback.

After Pixel or hosted checkout completes, NEFRU calls:

```text
POST /api/payments/:bookingId/reconcile
```

The backend asks Paymob for the last transaction belonging to the Paymob order and validates amount, currency, and Integration ID before confirming the booking.

This is a fallback for local testing or a delayed callback. Production must still use Paymob callbacks as the primary source of truth.

## 3. Full webhook + saved-card test with localhost

Saved-card token callbacks are inbound server-to-server requests, so Paymob needs a public HTTPS address for your local backend.

Example with ngrok:

```powershell
ngrok http 5000
```

Suppose ngrok returns:

```text
https://abc123.ngrok-free.app
```

Set:

```env
BACKEND_PUBLIC_URL=https://abc123.ngrok-free.app
PAYMOB_WEBHOOK_URL=https://abc123.ngrok-free.app/api/payments/paymob/webhook
```

Restart the backend after changing `.env`.

With a public callback and `PAYMENT_TOKEN_ENCRYPTION_KEY`, the embedded Paymob form exposes the Save Card option. After a valid HMAC-signed TOKEN callback, NEFRU stores only:

- encrypted Paymob token
- masked PAN / last four digits
- card brand
- expiry metadata

Saved cards appear in **Traveler Settings → Saved payment methods** and are passed back to Paymob on future checkout intentions.

## 4. Test cards

Use Paymob Test mode credentials and Test EGP Integration IDs only.

Known Paymob sandbox success examples:

```text
Visa:       4111 1111 1111 1111
Mastercard: 5123 4567 8901 2346
Expiry:     01/39
CVV:        123
Name:       TEST ACCOUNT
```

Do not use a real card while testing Sandbox credentials.

Paymob does not publicly document a complete set of deterministic cards for every issuer decline reason such as insufficient funds. Use Paymob-supported decline simulation/test data for those provider-specific scenarios instead of inventing fake card numbers.

## 5. Recommended scenarios

1. Successful sandbox payment → booking becomes `confirmed` + `paid`.
2. No public webhook, but `PAYMOB_API_KEY` configured → Transaction Inquiry confirms the successful payment locally.
3. Public tunnel enabled → HMAC transaction callback confirms payment.
4. Check **Save card** with tunnel enabled → TOKEN callback creates a saved method; verify it in Settings.
5. Remove saved card from Settings → token is disabled in NEFRU and no longer offered on future intentions.
6. Cancel/close checkout → booking stays pending until paid or the hold expires.
7. Let the 15-minute hold expire → seat is released.
8. Invalid card field input → Paymob Pixel validation blocks submission.
9. Provider-declined transaction (using a Paymob-supported decline scenario) → booking records `paymentStatus=failed` and the traveler can retry while the hold is active.
10. Repeat callback / repeat reconcile → confirmation remains idempotent and does not create a second booking.

## 6. Before production

- Use Live Paymob keys with Live EGP Integration IDs only.
- Deploy the backend on a public HTTPS URL.
- Point Paymob callbacks to the production `/api/payments/paymob/webhook` URL.
- Keep `PAYMENT_TOKEN_ENCRYPTION_KEY` stable and secret.
- Never expose Paymob Secret Key, API Key, HMAC secret, Cloudinary secret, or token-encryption key in frontend variables.
- Perform one small live smoke payment only after Paymob has enabled the account for Live processing.
