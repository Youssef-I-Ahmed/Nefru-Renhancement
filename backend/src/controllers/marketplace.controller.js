import { asyncHandler } from "../utils/asyncHandler.js";
import * as domain from "../services/marketplace.service.js";
import { Trip } from "../models/trip.model.js";
import { TripRevision } from "../models/tripRevision.model.js";
import { Occurrence } from "../models/occurrence.model.js";
import { Booking } from "../models/booking.model.js";
import { Review } from "../models/review.model.js";
import { PrivateExperienceSurvey } from "../models/privateExperienceSurvey.model.js";
import { OperationalCase } from "../models/operationalCase.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { GuideProfile } from "../models/guide.model.js";
import { TouristProfile } from "../models/tourist.model.js";
import { demand, sameId, tripState } from "../domain/policies.js";
import { moderateReview } from "../services/reviewLifecycle.service.js";
import { qualityMetrics } from "../services/quality.service.js";

const reply = (fn) =>
  asyncHandler(async (req, res) =>
    res.json({ success: true, data: await fn(req) }),
  );
export const guideQuality = reply((req) => {
  demand(
    req.user.role === "admin" ||
      (req.user.role === "guide" && sameId(req.user, req.params.id)),
    "Quality access denied",
    403,
  );
  return qualityMetrics(req.params.id, {
    includePrivate: req.user.role === "admin",
  });
});
export const tripAction = reply((req) =>
  domain.actOnTrip(
    req.params.id,
    req.params.action,
    req.user,
    req.body.reason || "",
  ),
);
export const revisionAction = reply((req) =>
  domain.actOnRevision(
    req.params.id,
    req.params.action,
    req.user,
    req.body.reason || "",
  ),
);
export const occurrenceAction = reply((req) =>
  domain.actOnOccurrence(
    req.params.id,
    req.params.action,
    req.user,
    req.body.reason || "",
  ),
);
export const attendanceAction = reply((req) =>
  domain.attendanceAction(
    req.params.id,
    req.params.action,
    req.user,
    req.body.reason || "",
  ),
);
export const accountAction = reply((req) =>
  domain.accountAction(
    req.params.id === "me" ? req.user._id : req.params.id,
    req.params.action,
    req.user,
    req.body.reason || "",
  ),
);
export const verificationAction = reply((req) =>
  domain.verificationAction(
    req.params.id,
    req.params.action,
    req.user,
    req.body,
  ),
);
export const reviewAction = reply((req) =>
  moderateReview(
    req.params.id,
    req.params.action,
    req.user,
    req.body.reason || "",
  ),
);
export const editTrip = reply((req) =>
  domain.editTrip(req.params.id, req.body, req.user),
);
export const getEditableTrip = reply(async (req) => {
  const trip = await Trip.findById(req.params.id).select("+moderation").lean();
  demand(
    trip && (req.user.role === "admin" || sameId(trip.guide, req.user)),
    "Trip access denied",
    403,
  );
  const revision = await TripRevision.findOne({
    trip: trip._id,
    open: true,
  }).lean();
  return {
    ...trip,
    ...(revision?.content || {}),
    id: trip._id,
    revisionId: revision?._id,
    revisionStatus: revision?.reviewStatus,
  };
});
export const dashboard = reply(async (req) => {
  demand(
    ["guide", "admin"].includes(req.user.role),
    "Guide or admin required",
    403,
  );
  const filter = req.user.role === "admin" ? {} : { guide: req.user._id };
  const trips = (
    await Trip.find(filter)
      .select("title lifecycleStatus reviewStatus status guide featured")
      .lean()
  ).map((t) => ({ ...t, ...tripState(t) }));
  const revisions = await TripRevision.find({
    ...filter,
    ...(req.user.role === "admin" ? { reviewStatus: "in_review" } : {}),
  })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  const occurrences = await Occurrence.find(filter)
    .sort({ startsAt: -1 })
    .limit(100)
    .lean();
  const bookings = await Booking.find({
    occurrence: { $in: occurrences.map((o) => o._id) },
    status: { $in: ["confirmed", "completed"] },
  })
    .select("_id occurrence tourist attendance status paymentStatus")
    .lean();
  const travelerProfiles = await TouristProfile.find({
    user: { $in: bookings.map((booking) => booking.tourist) },
  })
    .select("user fullName avatar")
    .lean();
  const travelersByUser = new Map(
    travelerProfiles.map((profile) => [String(profile.user), profile]),
  );
  const rosterBookings = bookings.map((booking) => {
    const traveler = travelersByUser.get(String(booking.tourist));
    return {
      ...booking,
      traveler: {
        fullName: traveler?.fullName || "Traveler",
        avatar: traveler?.avatar || "",
      },
    };
  });
  const reviews =
    req.user.role === "admin"
      ? await Review.find({
          moderationStatus: { $in: ["pending_moderation", "published"] },
        })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean()
      : [];
  const cases =
    req.user.role === "admin"
      ? await OperationalCase.find({ status: "open" }).limit(100).lean()
      : [];
  const verifications =
    req.user.role === "admin"
      ? await GuideProfile.find({
          $or: [
            {
              identityStatus: {
                $in: ["pending", "renewal_in_review", "expired"],
              },
            },
            {
              licenseStatus: {
                $in: ["pending", "renewal_in_review", "expired"],
              },
            },
            { verificationStatus: "pending" },
          ],
        })
          .select(
            "user fullName identityStatus identityExpiresAt licenseStatus licenseExpiresAt verificationStatus",
          )
          .limit(100)
          .lean()
      : [];
  return {
    trips,
    revisions,
    occurrences,
    bookings: rosterBookings,
    reviews,
    cases,
    verifications,
    quality:
      req.user.role === "guide" ? await qualityMetrics(req.user._id) : null,
  };
});
export const reviewDetail = reply(async (req) => {
  demand(req.user.role === "admin", "Admin required", 403);
  const review = await Review.findById(req.params.id)
    .select("+moderationReason")
    .lean();
  demand(review, "Review not found", 404);
  return {
    review,
    booking: await Booking.findById(review.booking)
      .select("-paymobClientSecret")
      .lean(),
    survey: await PrivateExperienceSurvey.findOne({
      booking: review.booking,
    }).lean(),
  };
});
export const caseDetail = reply(async (req) => {
  demand(req.user.role === "admin", "Admin required", 403);
  const item = await OperationalCase.findById(req.params.id).lean();
  demand(item, "Case not found", 404);
  return {
    case: item,
    booking: item.booking
      ? await Booking.findById(item.booking)
          .select(
            "status paymentStatus attendance occurrence trip tourist guide",
          )
          .lean()
      : null,
    survey: item.booking
      ? await PrivateExperienceSurvey.findOne({ booking: item.booking }).lean()
      : null,
  };
});
export const auditHistory = reply(async (req) => {
  demand(req.user.role === "admin", "Admin required", 403);
  return AuditLog.find({ entityId: req.params.id })
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();
});
export const merchandising = reply(async (req) => {
  demand(req.user.role === "admin", "Admin required", 403);
  demand(
    ["trips", "guides"].includes(req.params.kind),
    "Unknown merchandising target",
    400,
  );
  demand(
    typeof req.body.featured === "boolean",
    "featured must be boolean",
    400,
  );
  return domain.atomic(async (session) => {
    const Model = req.params.kind === "trips" ? Trip : GuideProfile;
    const doc = await Model.findById(req.params.id).session(session);
    demand(doc, "Content not found", 404);
    const before = { featured: doc.featured };
    doc.featured = req.body.featured;
    doc.featuredFrom = req.body.featuredFrom
      ? new Date(req.body.featuredFrom)
      : null;
    doc.featuredUntil = req.body.featuredUntil
      ? new Date(req.body.featuredUntil)
      : null;
    demand(
      !doc.featuredUntil ||
        doc.featuredUntil > (doc.featuredFrom || new Date()),
      "Invalid featured interval",
      400,
    );
    await doc.save({ session });
    await domain.audit(
      session,
      req.user,
      "merchandising_changed",
      req.params.kind,
      doc,
      before,
    );
    return {
      id: doc._id,
      featured: doc.featured,
      featuredFrom: doc.featuredFrom,
      featuredUntil: doc.featuredUntil,
    };
  });
});
export const resolveCase = reply(async (req) => {
  demand(req.user.role === "admin", "Admin required", 403);
  return domain.atomic(async (session) => {
    const item = await OperationalCase.findById(req.params.id).session(session);
    demand(item && item.status === "open", "Open case not found", 404);
    demand(
      String(req.body.reason || "").trim().length >= 3,
      "Resolution reason required",
      400,
    );
    if (item.type === "attendance_dispute") {
      demand(
        ["checked_in", "no_show"].includes(req.body.attendance),
        "Resolve attendance explicitly",
        400,
      );
      const b = await Booking.findById(item.booking).session(session);
      demand(
        b?.attendance?.status === "attendance_disputed",
        "Attendance is not disputed",
      );
      b.attendance = {
        status: req.body.attendance,
        markedBy: req.user._id,
        markedAt: new Date(),
      };
      await b.save({ session });
      await domain.audit(
        session,
        req.user,
        "attendance_resolved",
        "Booking",
        b,
        { attendance: "attendance_disputed" },
        req.body.reason,
      );
      if (
        b.status === "completed" &&
        b.paymentStatus === "paid" &&
        b.attendance.status === "checked_in"
      )
        await domain.enqueue(
          session,
          `review-invite:${b._id}`,
          "review_invitation",
          { booking: String(b._id) },
        );
    }
    item.status = "resolved";
    item.resolution = req.body.reason;
    item.resolvedAt = new Date();
    item.resolvedBy = req.user._id;
    await item.save({ session });
    await domain.audit(
      session,
      req.user,
      "case_resolved",
      "OperationalCase",
      item,
      { status: "open" },
      req.body.reason,
    );
    return item;
  });
});
// Existing clients retain their URLs, but every mutation goes through the same policy service.
export const legacyTripStatus = reply(async (req) => {
  const action =
    req.body.action ||
    { reviewing: "submit", active: "approve", rejected: "reject" }[
      req.body.status
    ];
  if (req.body.status === "draft")
    return domain.editTrip(req.params.id, {}, req.user);
  const revision = await TripRevision.findOne({
    trip: req.params.id,
    open: true,
  });
  if (action === "submit" && revision)
    return domain.actOnRevision(revision._id, "submit", req.user);
  return domain.actOnTrip(
    req.params.id,
    action,
    req.user,
    req.body.reason || "",
  );
});
export const legacyModeration = reply((req) =>
  domain.actOnTrip(
    req.params.id,
    { publish: "approve", return_changes: "request_changes" }[
      req.body.action
    ] || req.body.action,
    req.user,
    req.body.reason || "",
  ),
);
export const legacyDelete = reply((req) =>
  domain.accountAction(
    req.params.id,
    "request_deletion",
    req.user,
    "Deletion requested by administrator",
  ),
);
export const legacyBan = reply((req) =>
  domain.accountAction(
    req.params.id,
    "suspend",
    req.user,
    req.body.reason || "Administrative suspension",
  ),
);
export const legacyUnban = reply((req) =>
  domain.accountAction(
    req.params.id,
    "restore",
    req.user,
    req.body.reason || "Administrative restoration",
  ),
);
export const legacyVerification = reply((req) =>
  domain.verificationAction(req.params.id, req.body.action, req.user, req.body),
);
export const legacyGuideActivation = (action) =>
  reply((req) =>
    action === "suspend"
      ? domain.accountAction(
          req.params.id,
          "suspend",
          req.user,
          req.body.reason || "Administrative suspension",
        )
      : domain.verificationAction(req.params.id, action, req.user, req.body),
  );
