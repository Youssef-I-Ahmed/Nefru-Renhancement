import test from "node:test";
import assert from "node:assert/strict";
import {
  transitionTrip,
  tripState,
  verificationValid,
  reviewEligible,
  cancellationEntitlement,
  publicGuide,
} from "../domain/policies.js";
import { legacyReviewMapping } from "../scripts/migrateMarketplace.js";
import { loginUserSchema } from "../controllers/validation/userValidation.js";
const guide = { _id: "guide", role: "guide" },
  admin = { _id: "admin", role: "admin" };
const draft = {
  guide: "guide",
  lifecycleStatus: "draft",
  reviewStatus: "not_submitted",
};
test("trip moderation prevents owner/admin privilege and hard rejection bypass", () => {
  assert.throws(() => transitionTrip(draft, "approve", guide));
  const submitted = { ...draft, ...transitionTrip(draft, "submit", guide) };
  const rejected = {
    ...submitted,
    ...transitionTrip(submitted, "reject", admin, "prohibited content"),
  };
  assert.throws(() => transitionTrip(rejected, "submit", guide));
  assert.equal(
    transitionTrip(rejected, "reopen", admin, "investigation resolved")
      .reviewStatus,
    "changes_requested",
  );
  assert.throws(() => transitionTrip(submitted, "reject", admin, ""));
  assert.throws(() =>
    transitionTrip(draft, "submit", { _id: "other", role: "guide" }),
  );
});
test("pause/hide/archive do not mutate booking records and restore remains paused", () => {
  const trip = { ...draft, lifecycleStatus: "live", reviewStatus: "approved" };
  assert.equal(
    transitionTrip(trip, "pause", guide).lifecycleStatus,
    "paused_by_guide",
  );
  const hidden = {
    ...trip,
    ...transitionTrip(trip, "hide", admin, "safety investigation"),
  };
  assert.throws(() => transitionTrip(hidden, "resume", guide));
  assert.equal(
    transitionTrip(hidden, "restore", admin, "resolved").lifecycleStatus,
    "paused_by_guide",
  );
  assert.equal(
    transitionTrip(trip, "archive", guide).lifecycleStatus,
    "archived",
  );
});
test("legacy state mapping is conservative and distinguishes changes from rejection", () => {
  assert.equal(tripState({ status: "approved" }).lifecycleStatus, "draft");
  assert.equal(
    tripState({ status: "draft", moderation: { lastAction: "hidden" } })
      .lifecycleStatus,
    "hidden_by_admin",
  );
  assert.equal(
    tripState({
      status: "rejected",
      moderation: { lastAction: "changes_requested" },
    }).reviewStatus,
    "changes_requested",
  );
  assert.deepEqual(
    legacyReviewMapping({ isVisible: true, isVerifiedBooking: true }),
    {
      moderationStatus: "published",
      provenance: "legacy",
      isVerifiedBooking: false,
    },
  );
});
test("verification expiry is enforced even before worker runs", () => {
  const now = new Date("2030-01-01");
  const p = {
    identityStatus: "approved",
    licenseStatus: "renewal_in_review",
    licenseExpiresAt: new Date("2029-12-31"),
  };
  assert.equal(verificationValid(p, { at: now }), true);
  assert.equal(verificationValid(p, { at: now, licenseRequired: true }), false);
  assert.equal(
    verificationValid(
      { ...p, identityExpiresAt: new Date("2029-12-31") },
      { at: now },
    ),
    false,
  );
});
test("review evidence and refund window boundaries", () => {
  const now = new Date("2030-01-01T12:00Z"),
    o = { status: "completed", actualEndedAt: now };
  const b = {
    status: "completed",
    paymentStatus: "paid",
    bookingSource: "web",
    attendance: { status: "checked_in" },
    date: new Date(+now + 86400000),
    policySnapshot: { touristFullRefundHours: 24 },
  };
  assert.equal(reviewEligible(b, o, now), true);
  for (const patch of [
    { bookingSource: "seed" },
    { paymentStatus: "unpaid" },
    { paymentStatus: "refunded" },
    { status: "cancelled" },
    { attendance: { status: "no_show" } },
  ])
    assert.equal(reviewEligible({ ...b, ...patch }, o, now), false);
  assert.equal(cancellationEntitlement(b, "tourist", now), "full_refund_due");
  assert.equal(
    cancellationEntitlement(
      { ...b, date: new Date(+b.date - 1) },
      "tourist",
      now,
    ),
    "admin_review",
  );
  assert.equal(cancellationEntitlement(b, "guide", now), "full_refund_due");
});
test("public guide DTO excludes private fields and demo emails pass real login validation", () => {
  const dto = publicGuide({
    fullName: "Demo guide",
    phoneNumber: "private",
    dateOfBirth: new Date(),
    email: "private",
    internalQualityScore: 1,
    documents: [],
    rejectionReason: "private",
  });
  assert.deepEqual(Object.keys(dto), ["fullName"]);
  assert.equal(
    loginUserSchema.validate({
      email: "tourist1@demo.example.com",
      password: "test-password",
    }).error,
    undefined,
  );
});
