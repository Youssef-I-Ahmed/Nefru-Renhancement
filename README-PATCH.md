# NEFRU Light Premium v2 — Tourist Finalization Batch 1

This cumulative patch includes all previous Light Premium v2 work plus the first Tourist Portal finalization batch.

## New in this version

### Saved experiences
- Rebuilt `/user/saved` with the shared `ExperienceCard` component.
- Saved/unsaved state updates immediately from the shared context.
- Added premium loading, empty, and error states.
- Added graceful broken-image handling so unavailable local media no longer renders a broken browser image.

### Reviews — real backend + frontend
- Added `/api/reviews` backend routes using the existing `Review` model.
- A tourist can review only a `completed` booking owned by their account.
- One review per booking is enforced by the existing unique booking constraint and controller checks.
- Added create, edit, delete, list-my-reviews, and public trip-review endpoints.
- Trip rating/review count and guide rating/review count are recalculated from verified review data.
- Trip review snapshots are rebuilt for the existing Tour Details UI.
- Guides receive a review notification when a new verified review is published.
- Rebuilt `/user/profile/reviews` with eligible completed bookings and real review history.

### Notifications
- Notifications now load automatically when the authenticated tourist shell mounts.
- Notifications page refreshes real API data and adds Payments + Reviews filters.
- Added icons for review/trip/reminder notification types.
- Redux now fetches up to 100 recent notifications and keeps the API unread count.
- Navbar unread badge uses the server unread count.

### Payment Methods temporary cleanup
- Removed the direct Stripe-management UI from `/user/profile/payments`.
- The route now shows a provider-neutral Paymob migration notice until the Paymob integration is implemented.

## Backend files added/changed
- `backend/src/controllers/review.controller.js`
- `backend/src/routes/review.routes.js`
- `backend/src/routes/index.js`

## Important
Cloudinary and Paymob are **not enabled in this batch yet**. They are the next integration phase and require environment configuration.

## Apply
Copy the `frontend` and `backend` folders over the project root, preserving paths.

Then run:

```bash
cd backend
npm run dev
```

and in another terminal:

```bash
cd frontend
npm run build
npm run dev
```

## Test
1. `/user/saved`
2. Complete a booking (guide side can mark it completed), then open `/user/profile/reviews`
3. Publish a review and confirm it appears on the tour details page
4. Open `/user/notifications` and confirm the unread badge/page use API data
5. `/user/profile/payments` should no longer expose Stripe configuration errors
