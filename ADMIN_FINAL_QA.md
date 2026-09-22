# NEFRU Admin Portal — Final QA

This cumulative patch closes the core Admin portal on top of the Tourist + Guide implementation.

## Admin routes

- `/admin/overview` — real platform operations overview
- `/admin/accounts` — tourist/guide/admin account management and guide verification review
- `/admin/cms` — tour moderation and guide feedback loop
- `/admin/booking` — booking + Paymob operations ledger
- `/admin/analytics` — paid-revenue and marketplace analytics

## Booking / Paymob operations

The admin UI exposes operational references only:

- booking status / payment status
- provider / payment method
- Paymob Intention ID
- Paymob Order ID
- Paymob Transaction ID
- payment reference
- 15-minute hold expiry / allocated seat when present
- traveler / guide / trip / occurrence
- total price / platform fee / guide earnings
- cancellation / completion timestamps

`paymobClientSecret`, `PAYMOB_SECRET_KEY`, and HMAC secrets are never returned or rendered.

Expired unpaid holds are reconciled through the existing `expirePendingBookings()` service when Admin booking operations are loaded.

## Analytics definitions

- Gross revenue = bookings where `paymentStatus === "paid"` only.
- Platform fees / guide earnings use persisted booking accounting fields.
- Paid conversion = paid booking records / booking records created in the selected range.
- Refund/payout execution is NOT simulated. The UI only displays recorded states.
- Available ranges: 30, 90, and 365 days.

## Smoke test

1. Sign in as Admin.
2. Open `/admin/overview` and confirm live counts render.
3. Open `/admin/accounts`, filter Guides, review a pending guide document, and verify approve/request-changes flows.
4. Open `/admin/cms`, open a Reviewing tour, inspect media/schedule/guide and test the moderation flow with test data.
5. Open `/admin/booking`:
   - search by booking ID or Paymob transaction/intention/order ID;
   - filter booking/payment status;
   - open a booking detail drawer;
   - confirm Paymob refs are visible but no client secret is present;
   - confirm paid money equals the booking record.
6. Open `/admin/analytics`, switch 30 / 90 / 365 days and verify cards, trend bars, breakdowns, top tours and top guides update.
7. Test responsive layouts around 390px, 768px, 1024px, and desktop width.
8. Set `DEV_AUTH_BYPASS=false` before production testing and verify role protection.

## Intentionally not implemented

These require a real provider/business workflow and must not be faked:

- Paymob refund execution
- guide payout/withdrawal execution
- chargeback/dispute actions
- manual marking of payments as paid

Those can be added later only after selecting and validating the exact provider API and business rules.
