import { AppError } from "../utils/AppError.js";

export const LIFECYCLES = [
  "draft",
  "live",
  "paused_by_guide",
  "hidden_by_admin",
  "archived",
];
export const REVIEWS = [
  "not_submitted",
  "in_review",
  "changes_requested",
  "approved",
  "rejected",
];
export const ACCOUNTS = [
  "active",
  "deactivated_by_user",
  "suspended_by_admin",
  "deletion_requested",
  "closed",
  "anonymized",
];
export const VERIFICATIONS = [
  "pending",
  "approved",
  "expiring_soon",
  "expired",
  "renewal_in_review",
  "rejected",
];
export const OCCURRENCES = [
  "upcoming",
  "check_in_open",
  "in_progress",
  "completed",
  "cancelled",
];
export const ATTENDANCE = [
  "booked",
  "checked_in",
  "no_show",
  "attendance_disputed",
];
export const MODERATION = [
  "pending_moderation",
  "published",
  "rejected",
  "hidden",
];
export const CONTENT_FIELDS = [
  "title",
  "description",
  "longDescription",
  "location",
  "coordinates",
  "price",
  "duration",
  "image",
  "imagePublicId",
  "category",
  "groupSize",
  "schedule",
  "gallery",
  "galleryPublicIds",
  "highlights",
  "identityVerificationRequired",
  "licenseRequired",
];
export function demand(
  condition,
  message,
  status = 409,
  code = "INVALID_TRANSITION",
) {
  if (!condition) throw new AppError(message, status, code);
}
export const sameId = (a, b) =>
  Boolean(a && b && String(a._id || a) === String(b._id || b));
export function tripState(trip) {
  if (trip.lifecycleStatus && trip.reviewStatus)
    return {
      lifecycleStatus: trip.lifecycleStatus,
      reviewStatus: trip.reviewStatus,
    };
  if (trip.moderation?.lastAction === "hidden")
    return { lifecycleStatus: "hidden_by_admin", reviewStatus: "approved" };
  if (trip.moderation?.lastAction === "changes_requested")
    return { lifecycleStatus: "draft", reviewStatus: "changes_requested" };
  const mapping = {
    active: ["live", "approved"],
    draft: ["draft", "not_submitted"],
    reviewing: ["draft", "in_review"],
    pending: ["draft", "in_review"],
    rejected: ["draft", "rejected"],
  };
  // Legacy approved is ambiguous: do not silently publish it.
  const [lifecycleStatus, reviewStatus] = mapping[trip.status] || [
    "draft",
    "not_submitted",
  ];
  return { lifecycleStatus, reviewStatus };
}
export function legacyTripStatus(trip) {
  if (trip.lifecycleStatus === "live") return "active";
  if (trip.reviewStatus === "rejected") return "rejected";
  if (trip.reviewStatus === "in_review") return "reviewing";
  return "draft";
}
export const accountActive = (user) =>
  Boolean(
    user &&
      user.status === "active" &&
      (!user.accountStatus || user.accountStatus === "active"),
  );
export function verificationValid(
  profile,
  { licenseRequired = false, at = new Date() } = {},
) {
  const identity = profile?.identityStatus || profile?.verificationStatus;
  if (!["approved", "expiring_soon", "renewal_in_review"].includes(identity))
    return false;
  if (profile.identityExpiresAt && new Date(profile.identityExpiresAt) <= at)
    return false;
  if (!licenseRequired) return true;
  return (
    ["approved", "expiring_soon", "renewal_in_review"].includes(
      profile.licenseStatus,
    ) &&
    profile.licenseExpiresAt &&
    new Date(profile.licenseExpiresAt) > at
  );
}
export function transitionTrip(trip, action, actor, reason = "") {
  demand(
    actor && ["guide", "admin"].includes(actor.role),
    "Guide or admin required",
    403,
  );
  demand(
    actor.role === "admin" || sameId(trip.guide, actor),
    "Trip ownership required",
    403,
  );
  const state = tripState(trip);
  const admin = [
    "approve",
    "request_changes",
    "reject",
    "hide",
    "restore",
    "reopen",
  ].includes(action);
  demand(!admin || actor.role === "admin", "Admin action required", 403);
  if (
    ["request_changes", "reject", "hide", "restore", "reopen"].includes(action)
  )
    demand(reason.trim().length >= 3, "A reason is required", 400);
  switch (action) {
    case "submit":
      demand(
        state.lifecycleStatus === "draft" &&
          ["not_submitted", "changes_requested"].includes(state.reviewStatus),
        "Only an editable submission can be submitted",
      );
      state.reviewStatus = "in_review";
      break;
    case "approve":
      demand(
        state.reviewStatus === "in_review" && state.lifecycleStatus === "draft",
        "Submission is not in review",
      );
      state.reviewStatus = "approved";
      state.lifecycleStatus = "live";
      break;
    case "request_changes":
    case "reject":
      demand(
        state.reviewStatus === "in_review" && state.lifecycleStatus === "draft",
        "Submission is not in review",
      );
      state.reviewStatus =
        action === "reject" ? "rejected" : "changes_requested";
      break;
    case "pause":
      demand(state.lifecycleStatus === "live", "Only live trips can be paused");
      state.lifecycleStatus = "paused_by_guide";
      break;
    case "resume":
      demand(
        state.lifecycleStatus === "paused_by_guide" &&
          state.reviewStatus === "approved",
        "Only guide-paused approved trips can resume",
      );
      state.lifecycleStatus = "live";
      break;
    case "hide":
      demand(
        ["live", "paused_by_guide"].includes(state.lifecycleStatus),
        "Trip cannot be hidden in its current state",
      );
      state.lifecycleStatus = "hidden_by_admin";
      break;
    case "restore":
      demand(
        state.lifecycleStatus === "hidden_by_admin",
        "Trip is not admin-hidden",
      );
      state.lifecycleStatus = "paused_by_guide";
      break;
    case "archive":
      demand(
        state.lifecycleStatus !== "archived" &&
          (actor.role === "admin" ||
            state.lifecycleStatus !== "hidden_by_admin"),
        "Trip cannot be archived",
      );
      state.lifecycleStatus = "archived";
      break;
    case "reopen":
      demand(
        state.reviewStatus === "rejected" && state.lifecycleStatus === "draft",
        "Only rejected drafts can be reopened",
      );
      state.reviewStatus = "changes_requested";
      break;
    default:
      demand(false, "Unknown trip action", 400);
  }
  return { ...state, status: legacyTripStatus(state) };
}
export function reviewEligible(booking, occurrence, now = new Date()) {
  return Boolean(
    booking &&
      booking.bookingSource !== "seed" &&
      booking.status === "completed" &&
      booking.paymentStatus === "paid" &&
      booking.attendance?.status === "checked_in" &&
      occurrence?.status === "completed" &&
      occurrence.actualEndedAt &&
      now <=
        new Date(new Date(occurrence.actualEndedAt).getTime() + 14 * 86400000),
  );
}
export function cancellationEntitlement(booking, actorRole, now = new Date()) {
  if (booking.paymentStatus !== "paid") return "not_applicable";
  if (booking.policySnapshot?.version === "legacy_unknown")
    return "admin_review";
  const hours = booking.policySnapshot?.touristFullRefundHours ?? 24;
  return ["admin", "guide"].includes(actorRole) ||
    new Date(booking.date) - now >= hours * 3600000
    ? "full_refund_due"
    : "admin_review";
}
export function publicGuide(profile) {
  const keys = [
    "_id",
    "fullName",
    "avatar",
    "headline",
    "location",
    "about",
    "yearsExperience",
    "languages",
    "specialties",
    "rating",
    "reviewsCount",
  ];
  return Object.fromEntries(
    keys
      .filter((key) => profile?.[key] !== undefined)
      .map((key) => [key, profile[key]]),
  );
}
