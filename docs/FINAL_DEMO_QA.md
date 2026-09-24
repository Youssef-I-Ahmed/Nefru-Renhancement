# NEFRU Final Demo QA

Run this checklist after `develop` is merged to `main` and hosted services finish deploying.

## Deployment

- Vercel deployment is successful.
- Railway API deployment is active.
- Railway domain worker deployment is active.
- `/api/health` responds.
- `/api/ready` confirms database readiness.
- Browser console has no blocking runtime errors.

## Public / guest

- `/` loads the welcome experience.
- `/explore` loads discovery content.
- `/trips` loads searchable experiences.
- Direct refresh on `/trips/:id` works.
- `/nearby` loads map tiles, pins, popups, and route UI.
- Mobile guest bottom navigation shows Home / Trips / Nearby / Sign in.
- Invalid URL shows the role-aware 404.

## Tourist

- Login persists across refresh.
- Save/unsave works.
- Profile, bookings, reviews, settings, and notifications load.
- A Paymob Sandbox booking can complete.
- Payment state survives refresh/callback reconciliation.
- Cancellation exposes refund state when applicable.
- Notifications update unread count/read state.
- Eligible completed/checked-in booking can enter the review workflow.

## Guide

- Approved guide dashboard loads.
- My Tours / create / edit / schedule / media flow works.
- Submitted experience appears in Admin moderation.
- Operations supports start/check-in/no-show/end/cancel rules.
- Bookings and earnings load.
- Reviews page shows published reviews only.
- Guide can post a public reply.
- Review/payment/booking notifications route to the correct Guide screen.

## Admin

- Overview loads.
- Accounts and guide verification review work.
- Tour moderation publish / request changes / reject / hide rules work.
- Bookings & Paymob detail loads provider references safely.
- Trust & Safety reviews/cases load.
- Refund action appears only after cancellation/refund-review eligibility.
- Analytics loads.
- Admin public browsing does not expose tourist notification navigation.

## Refund lifecycle

Sandbox/test data only:

```text
paid booking
→ cancellation/refund review
→ admin refund
→ Paymob confirmation
→ refunded booking/payment
→ unsettled earnings adjustment
→ notifications
→ case resolution
```

Verify duplicate provider callbacks do not duplicate refunded amount.

## Responsive / accessibility

Check at minimum:

- 375 px mobile
- 768 px tablet
- 1440 px desktop

Verify:

- no horizontal overflow
- fixed bottom navigation does not cover content
- `/nearby` and booking checkout/status do not show competing bottom navigation
- keyboard focus is visible
- dialogs/drawers remain usable
- Admin navigation remains readable
- reduced-motion preference does not break navigation

## Build quality

Before release:

```bash
git diff --check
npm run check
```

Expected frontend architecture:

- route-level JS chunks are emitted
- map bundle is deferred until `/nearby`
- no monolithic ~1 MB initial application JS entry

## Portfolio safety

- Demo banner is visible.
- No real customer/identity/payment data is present.
- No `.env` or provider secret is committed.
- Screenshots do not expose tokens, cookies, private verification documents, or confidential provider values.
- README live links are current.
