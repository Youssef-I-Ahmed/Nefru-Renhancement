# NEFRU — EGP migration + Admin Overview fix

This patch keeps **EGP as the source of truth** for new tours, bookings, Paymob charges, guide earnings, and admin accounting. USD/EUR/GBP are tourist display currencies only.

## 1) Merge the patch

Copy the files in this ZIP over the project root while preserving their paths. The ZIP intentionally contains only files that changed or were added.

The real `backend/.env` is intentionally not included because it contains secrets. In your existing `.env`, use an **EGP Paymob Integration ID** and set:

```env
PAYMOB_CURRENCY=EGP
```

The FX settings are optional because the code has safe defaults, but you can add:

```env
FX_PROVIDER_URL=https://api.frankfurter.dev/v2/rates
FX_PROVIDER=cbe
FX_REFRESH_HOURS=12
FX_REQUEST_TIMEOUT_MS=10000
```

## 2) Migrate the existing local MongoDB data once

From `backend/` run a dry run first:

```bash
npm run migrate:egp
```

Review the preview, then apply it:

```bash
npm run migrate:egp -- --apply
```

The migration uses the latest available Central Bank of Egypt (`cbe`) rate through Frankfurter. Existing **paid/refunded historical USD bookings are intentionally left unchanged** so financial history is not rewritten. Existing tours and unpaid legacy bookings are converted to EGP.

## 3) FX display behavior

- Real price and payment remain EGP.
- Tourist can choose EGP / USD / EUR / GBP from Settings.
- Cards and booking screens show the EGP price first, then a smaller approximate selected-currency value.
- The backend caches EGP exchange rates in MongoDB and refreshes them every 12 hours.
- If refresh fails, the last successful rates remain usable.
- If there has never been a successful FX refresh, EGP browsing and checkout still work; only the approximate line is omitted.

## 4) Admin Overview fix

The Overview crash happened because the API returned `topTours` as a table object while the React page called `dashboard.topTours.map(...)`. The backend now returns `topTours` as an array and exposes table metadata separately as `topToursTable`. The frontend also normalizes the old object shape defensively, so both shapes no longer crash the page.
