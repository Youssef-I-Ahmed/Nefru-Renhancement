# NEFRU Renhancement — Admin Phase 2 (Cumulative Patch)

This ZIP is cumulative. Apply it over the current `Youssef-I-Ahmed/Nefru-Renhancement` repository. It includes the completed Tourist work, Cloudinary + Paymob migration, the completed Guide portal, Admin Phase 1 overview/shell, and Admin Phase 2 Accounts + Guide Verification Review.

## Guide portal status

The Guide core remains complete in this cumulative patch:

- Real dashboard, tours, calendar, bookings and earnings.
- Refresh-safe experience create/edit workflow.
- Profile, notifications and real verification/resubmission flow.
- No fake payout provider or fake earnings.

Guide identity documents intentionally remain outside the public Cloudinary media flow. They are served only through the authenticated verification document endpoint. Before production on ephemeral infrastructure, private verification storage must be moved to durable private storage.

## Admin Phase 1 retained

- NEFRU Light Premium Admin shell.
- Real `/admin/overview` operational dashboard.
- Paid-revenue accounting corrected to use `paymentStatus === "paid"`.
- Guide verification queue, tour moderation queue, booking/payment health, recent bookings and top tours.

## Admin Phase 2 — Accounts + Guide verification

### Accounts API v2

Added protected admin endpoints while keeping the old `/admin/user` endpoints for backward compatibility:

- `GET /api/admin/accounts`
  - `role=tourist|guide|admin`
  - server-side `q` search by email/profile name
  - account status filter
  - guide verification status filter
  - pagination
  - role counts, pending guide verification count and suspended-account count
- `GET /api/admin/accounts/:id`
  - account details
  - tourist/guide profile
  - guide activity counts
  - safe verification metadata
  - document metadata, requested changes and review history (never exposes storage keys)
- `PATCH /api/admin/accounts/:id/verification`
  - `approve`
  - `reject` with a general reason
  - optional document-specific requested changes

### Guide verification review

The Admin now reviews the real verification workflow instead of approving from a shallow account row:

- Open National ID / Passport / Guide License through the existing authenticated document route.
- Approve only a **pending** application that contains a National ID or Passport.
- Return a pending application for changes with a required reason.
- Optionally attach a specific replacement request to one or more uploaded documents.
- Requested document changes use the existing `GuideVerification.requestedChanges` model, so replacing a document on the Guide side resolves the matching request before resubmission.
- Review history, reviewed timestamp, notification and email are updated by the backend.
- Approved guides are told they can manage experiences and submit them for publication; approval does not bypass Admin tour moderation.

### Account access

- Suspend/reactivate accounts without deleting historical data.
- Admin accounts are protected from suspend/delete actions in this UI.
- Permanent delete remains available for Tourist/Guide accounts through the existing protected backend endpoint.

### Private document access

Added `apiFileRequest()` to the frontend API service. It uses the same authenticated cookie and development-role behavior as normal API calls, but returns binary files. This prevents verification documents from being exposed as public media URLs.

## Apply

Extract this ZIP into the repository root and allow it to replace matching files.

```bash
cd backend
npm install

cd ../frontend
npm install
```

Run:

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

## QA order

1. Sign in as Admin and open `/admin/accounts`.
2. Switch Travelers / Guides / Admins.
3. Search by email and profile name.
4. Test Active / Pending / Suspended filtering.
5. On Guides, test verification filters.
6. Select a pending Guide and open every uploaded verification document.
7. Approve one valid pending Guide and confirm status + Guide notification update.
8. For another pending Guide, choose **Request changes**, write a general reason, optionally select a document and add a replacement message.
9. Sign in as that Guide and confirm `/guide/verification` shows the rejection + requested change.
10. Replace the requested document and resubmit; confirm it returns to the Admin pending queue.
11. Test Suspend -> sign-in blocked, then Reactivate.
12. Check desktop/tablet/mobile layouts.

## Validation completed here

- Frontend cumulative patch: TypeScript JSX parser -> **0 syntax errors**.
- Backend cumulative patch: `node --check` -> all included backend JS files passed.
- New verification review response explicitly serializes safe document metadata and does not return verification `storageKey` values.
- Full Vite build must still be run in the complete repository after `npm install`, because this ZIP is an overlay patch rather than a full Git checkout.

## Next Admin phases

1. Tour Moderation: full experience review, media/schedule visibility, publish/reject reason flow.
2. Booking + Paymob operations: payment references/statuses and admin payment visibility without inventing refunds.
3. Analytics.
4. Final Admin QA and responsive pass.

---

## Admin Phase 3 — Tour moderation

The old CMS moderation screen has been replaced with a full experience-review workspace backed by new protected Admin endpoints.

### New moderation API

- `GET /api/admin/tour-reviews`
  - pagination
  - status filters: all / awaiting review / live / draft / rejected
  - server-side search by title, location or category
  - real queue counts
- `GET /api/admin/tour-reviews/:id`
  - full experience content
  - guide profile and verification status
  - cover + gallery
  - normalized availability/schedule
  - publish-readiness checks
  - paid booking/revenue context
  - moderation history
- `PATCH /api/admin/tour-reviews/:id`
  - `publish`
  - `return_changes` with required reason
  - `reject` with required reason
  - `hide` for a live experience with required reason

### Publish safety

Publishing is now backend-enforced. An experience cannot be published unless:

- it is currently submitted for review;
- the Guide is verified;
- core content is present;
- a cover image exists;
- at least one future availability slot exists.

The Admin receives an explicit list of missing requirements instead of being allowed to publish an incomplete experience.

### Guide feedback round-trip

Trip moderation now stores the latest decision and an audit history on the Trip itself. The Guide's My Tours API was upgraded so returned/rejected experiences expose the moderation feedback.

The Guide UI now distinguishes:

- Live
- In review
- Draft
- Rejected

and shows **Changes requested** or **Submission rejected** feedback directly on the affected experience card.

### Publishing security fix

The existing route already had a `restrictGuideTripStatus` middleware but it was not attached to the status route. This cumulative patch wires it in and replaces the Guide list/status handlers with v2 handlers:

- Guides can set only `draft` or `reviewing`.
- Guides cannot activate/publish their own experiences.
- Resubmission records a `submitted` moderation-history entry and clears the current feedback reason.
- Admin publication continues only through the protected Admin moderation API.

### Notifications

Every moderation decision creates a `trip` notification for the Guide and attempts the matching email notification:

- published
- changes requested
- rejected
- hidden

## Admin Phase 3 QA

1. Sign in as a verified Guide and submit an experience for review.
2. Sign in as Admin and open `/admin/cms`.
3. Confirm the submitted experience appears under **Awaiting review**.
4. Open it and review Basics, Guide, Media and Availability.
5. Try Publish on an incomplete submission and confirm the backend blocks it with the missing requirements.
6. Request changes with a reason, then sign back in as the Guide and confirm the feedback appears in **My tours**.
7. Update the experience and resubmit it.
8. Publish the corrected submission and confirm it moves to **Live** and becomes public.
9. Hide a live experience with a required reason and confirm it disappears from public discovery.
10. Test Reject -> Guide feedback -> resubmit behavior.
11. Test search, pagination and status filters on desktop/tablet/mobile.

## Next Admin phases

1. Booking + Paymob operations: payment references/statuses, booking detail and payment visibility without inventing refunds.
2. Analytics.
3. Final Admin QA, responsive pass and dead-code cleanup.

---

## Admin Phase 4 — Bookings, Paymob Operations & Analytics (Admin Complete)

This cumulative package now closes the core Admin portal.

### New admin APIs

```text
GET /api/admin/booking-operations
GET /api/admin/booking-operations/:id
GET /api/admin/analytics?days=30|90|365
```

### Booking Operations

`/admin/booking` is no longer the legacy read-only table. It now supports server-side search and filters, a detailed booking drawer, traveler/guide/experience context, hold state, persisted money split, and Paymob operational references.

Sensitive Paymob values are deliberately excluded. In particular, the persisted `paymobClientSecret` remains hidden and is never serialized to Admin frontend code.

### Analytics

`/admin/analytics` is now backed by real MongoDB aggregates. Revenue includes only bookings with `paymentStatus: paid`; it does not count unpaid/pending bookings.

The page includes paid revenue, platform fees, guide earnings, paid conversion, average booking value, completion/cancellation rates, booking/payment/provider distributions, trend data, new-user activity, top tours and top guides.

### No fake financial actions

Refunds, payouts, disputes, and manual payment confirmation are intentionally not implemented. They require verified provider/business workflows rather than UI-only actions.

See `ADMIN_FINAL_QA.md` for the final smoke-test checklist.
