# NEFRU marketplace implementation

Current scope: a portfolio/demo application. No deployment, Atlas creation, local
MongoDB conversion, live data migration, key rotation, commit or push is performed
by this implementation. Existing uncommitted work is retained.

## Architecture and contracts

`backend/src/domain/policies.js` defines business state guards. Existing HTTP
routes delegate sensitive mutations to `marketplace.service.js`,
`reservation.service.js` and `reviewLifecycle.service.js`. New explicit actions
are mounted at `/api/marketplace`. Authorization always runs on the server.

| Domain | Implementation |
| --- | --- |
| Trip | Stable `_id`; separate lifecycle and moderation; legacy `status` remains a compatibility mirror. Hard rejection requires an audited admin reopen. |
| TripRevision | Separate collection; one open revision per trip enforced by a partial unique index; published content stays unchanged until approval. Base version, ownership, eligibility and state are rechecked in the transaction. |
| Occurrence | Persistent `(trip, occurrenceKey)` identity; configurable start window; actual start/end; separate cancellation. Delivered occurrences survive schedule changes. |
| Booking | One tourist and one seat. Immutable price/content/policy snapshots; separate payment and settlement states. Pause/hide/archive do not cancel bookings. |
| Seat holds | Transactional reservation and expiry. Unique seat/active booking constraints and write fences serialize bookings against moderation/cancellation. The old seat TTL must be removed by the explicit migration. |
| Payment | Existing Paymob HMAC/inquiry verification remains authoritative. The internal finalizer records PaymentAttempt history atomically. A duplicate success cannot reopen a completed booking. Late success opens refund review without allocating a seat. |
| Attendance | Embedded in Booking. Owned guide check-in/no-show after valid start; no-show has a grace period. Traveler disputes open OperationalCase; admin resolves with a reason. |
| Review | Paid + completed occurrence + checked-in evidence, within 14 days. One review per booking; moderation required. Negative ratings are not a rejection reason. Withdrawal preserves history. |
| Private survey | Separate collection; public serializers exclude it. Safety/problem answers open an admin case. Guides receive aggregates only after five responses, with private text and safety details withheld. |
| Ratings | Trip/Guide means use published, visible, verified reviews only. Hiding removes rating contribution. Legacy/demo reviews retain text but have no invented verification or rating contribution. |
| Internal quality | `survey-mean-v1`: mean of available survey-dimension averages, scaled to 0–100. No answers means no score. Cancellation/completion counts are separate signals. No automatic punishment. |
| Verification | Mandatory identity; conditional activity license; per-kind submission/review timestamps and expiry. Expiry blocks new eligibility immediately, independent of worker timing. Renewal never automatically resumes a paused/hidden trip. |
| Accounts | Suspension, user deactivation and deletion request remain distinct. Tokens are invalidated. Closure is blocked by future obligations, unsettled earnings or holds. No cascading business-data deletion or automatic anonymization. |
| CMS | Admin featured flag/date interval is independent of moderation. Public selection still requires account, verification and trip eligibility. Top-guide selection uses actual published-review metrics. |
| Audit/outbox | Sensitive business mutations and their audit/job writes share MongoDB transactions. Persistent job leases and event keys protect retries. SMTP delivery is at-least-once, not exactly-once. |

Account merges between distinct user IDs now require support review rather than
silently stranding booking/verification references. Linking Google to the same
identity remains supported. Legacy media cleanup checks published trips, revisions,
profiles and booking snapshots before deleting a Cloudinary asset.

## State transitions

- Trip: `draft → in_review → approved/live`; `changes_requested → edit → submit`;
  `rejected → admin reopen → changes_requested`. `live ↔ paused_by_guide` requires
  eligibility. Admin restore from `hidden_by_admin` returns to paused, never
  silently live. Archive blocks discovery and new booking.
- Revision: `draft → in_review → approved/rejected/changes_requested`. Approval
  preserves the trip ID and increments publishedVersion. Booked future slots
  cannot be removed/moved/shortened or reduced; material location/duration changes
  require resolving affected bookings. Price changes affect new bookings only.
- Occurrence: `upcoming → check_in_open/in_progress → completed`; cancellation
  is explicit before start. System completion applies only to started occurrences.
  A missing start opens investigation instead of fabricating attendance/completion.
- Attendance: `booked → checked_in/no_show`; tourist can dispute booked/no-show
  after the scheduled start. Only admin investigation resolves a dispute.
- Review: `pending_moderation → published/rejected`; `published → hidden`;
  authenticated author edits re-enter moderation. Hidden reviews can be republished
  through the explicit admin action.

## Financial rules

EGP is the booking/payment/accounting currency. FX remains approximate display.
Default commission is zero basis points. New bookings snapshot commission,
24-hour tourist refund threshold and 24-hour post-completion dispute window.
Guide/admin cancellation records full-refund entitlement; late tourist cancellation
and exceptional/unknown historical contracts go to admin review. These changes
do not issue refunds, payouts or alter provider balances.

Collected money, earned/available money and settlement are separate. The guide
dashboard excludes not-yet-available and already-settled earnings from availability.
No automated payout system is asserted by that display.

## Runtime and UI

- `npm start` checks transaction-capable topology and declared indexes before
  listening. It refuses standalone MongoDB and the legacy seat TTL index, without
  reconfiguring either. `/api/health` is liveness; `/api/ready` checks DB connectivity.
- Run `npm run worker:domain` as a separate persistent process with the same ENV.
  It expires holds, handles verification reminders, detects missing starts, completes
  overdue started occurrences and delivers notifications/review invitations.
- First review invitation: about 45 minutes after completion; reminders at 24/72
  hours if still eligible and no review exists. Demo email addresses are not mailed.
- Mail uses the existing shared NEFRU HTML shell and escaped template data.
- `/guide/operations`, `/admin/operations`, `/user/experience-support` expose the
  new actions. Existing trip edit pages read private draft/revision content.
- Home/Available Today use real API inventory and remaining seats, with no fabricated
  rating, scarcity or availability fallback. A global portfolio banner identifies
  fictional content. Production credentials are never included in frontend ENV.

## Model migration matrix

| Model/current fields | Added or mapped fields | Safe treatment / indexes / rollback concern |
| --- | --- | --- |
| Trip.status | lifecycleStatus, reviewStatus, publishedVersion, bookingFence, eligibility and featured flags | active→live/approved; reviewing/pending→draft/in_review; rejected→draft/rejected; explicit moderation hidden/changes_requested takes precedence; ambiguous approved is quarantined as draft and reported. Keep old status mirror. |
| Booking booking/payment fields | occurrence, tripSnapshot, policySnapshot, attendance, commission/availability/settlement/refund metadata | Existing money/provider IDs are unchanged. Partial legacy snapshots contain known facts only; policy is legacy_unknown. No check-in/completion evidence is fabricated. Existing active unique booking constraints remain. |
| BookingSeat.expiresAt TTL | expiry controlled by transactions | Migration drops only a single-field expiresAt TTL of zero seconds, then clears seat expiry timestamps. Never recreate this TTL while the new application is running. |
| User.status | accountStatus, source/reason/timestamps, retentionUntil, anonymizationEligibleAt, legalHold, operationalHold | Active maps active; inactive reasons remain explicitly unknown and require operator review. No deletion or anonymization job is enabled. |
| GuideProfile.verificationStatus | identityStatus/expiry, licenseStatus/expiry, private quality score | Existing identity approval is compatibility evidence, not fabricated documents. License starts pending. Existing real requirements must be reviewed by admin. |
| GuideVerification | per-kind submitted/reviewed timestamps; optimistic concurrency | Legacy generic timestamps are read for identity compatibility. Documents are private; hosted storage needs a private persistent volume. |
| Review.isVisible/isVerifiedBooking | moderationStatus, provenance, moderator metadata | Legacy visible→published, otherwise hidden; provenance legacy and verified false. Unique booking index retained. |
| New collections | TripRevision, Occurrence, PrivateExperienceSurvey, OperationalCase, AuditLog, DomainJob, PaymentAttempt | Unique open revision, trip/key, survey booking, case/event key and sparse provider transaction ID indexes prevent duplication. |
| Notification | eventKey | Sparse unique index keeps old notifications compatible and deduplicates new deliveries. |

## Safe migration procedure — prepared, not executed

The migration intentionally accepts only Atlas database `nefru_portfolio_demo`
and the configured exact `DEMO_ATLAS_HOST`. It does not target local databases.

1. Back up the target demo DB and verify a restore in an isolated environment.
2. Stop API/worker writers; record current counts, indexes and configuration.
3. From backend run:

   ```powershell
   node --env-file=.env.demo src/scripts/migrateMarketplace.js --dry-run
   node --env-file=.env.demo src/scripts/migrateMarketplace.js --apply
   node --env-file=.env.demo src/scripts/migrateMarketplace.js --dry-run
   ```

4. Inspect manual-mapping IDs. Resolve malformed/group legacy bookings and
   ambiguous approval before serving them. Verify relationships, indexes and
   counts; start API and worker only after this review.
5. Migration updates missing fields/upserts identities and is repeat-safe; it is
   not a single all-instance transaction. Keep writers stopped during recovery
   and rerun after fixing the reported failure.

Rollback: stop new writers, retain both the pre-change backup and any later
business records, and restore into an isolated database first. Reverting code
alone is unsafe because the old code can directly edit live trips and expects the
old seat TTL. Never drop new records or recreate TTL indexes as an automatic rollback.
After post-migration writes exist, use an explicit reconciliation/forward-fix plan.

## Validation and boundaries

Tests cover actual transactions in a separate temporary replica set, commit/abort,
competing seat claims, protected publication and booked schedules, payment amount
mismatch and repeated/late confirmations, attendance/review evidence, confidential
survey handling, verification submission, notification deduplication, account history,
login/profile/public API and role checks. Existing local service/data are never used.

`NEFRU_TEST_MONGOD` opts into those integration tests; without it the integration
test is explicitly skipped. CI installs its own test binary on a disposable Ubuntu
runner and runs syntax, tests, lint and build. CI has not been executed remotely.

Remaining external validation: Atlas credentials/network/index permissions, real
Cloudinary demo images, SMTP delivery and Paymob **sandbox** checkout/webhook/inquiry
with actual test credentials. No such success is inferred from mocked provider data.
`backend/.env.demo` was absent during this implementation.

Portfolio boundaries: conditional tourist identity experiences fail closed until
an approved tourist-document workflow is provided; demo trips do not require it.
Private guide documents need a persistent private volume; do not enable real-document
collection on an ephemeral host. No automated refunds/payouts/anonymization run.
Unrestricted shared guide/admin credentials must not be published. Broad visitor
abuse controls, monitoring and a formal retention policy remain live-service work.

## References

- [MongoDB Ubuntu installation](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-ubuntu/)
  informs the isolated CI binary installation; local validation uses installed 8.2.3.
- [Vercel Vite deployment](https://vercel.com/docs/frameworks/frontend/vite)
  documents SPA rewrites. `frontend/vercel.json` prepares refresh/deep links only;
  it does not deploy or proxy API traffic.
