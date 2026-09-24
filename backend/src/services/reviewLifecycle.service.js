import { Booking } from "../models/booking.model.js";
import { Occurrence } from "../models/occurrence.model.js";
import { Review } from "../models/review.model.js";
import { PrivateExperienceSurvey } from "../models/privateExperienceSurvey.model.js";
import { Trip } from "../models/trip.model.js";
import { GuideProfile } from "../models/guide.model.js";
import { demand, reviewEligible, sameId } from "../domain/policies.js";
import { atomic, audit, enqueue } from "./marketplace.service.js";
import { qualityMetrics } from "./quality.service.js";
import { OperationalCase } from "../models/operationalCase.model.js";

export async function recomputeRatings(tripId, guideId, session = null) {
  const match = {
    moderationStatus: "published",
    isVerifiedBooking: true,
    provenance: "verified",
    isVisible: true,
  };
  for (const [Model, filter, reviewFilter] of [
    [Trip, { _id: tripId }, { trip: tripId }],
    [GuideProfile, { user: guideId }, { guide: guideId }],
  ]) {
    const rows = await Review.find({ ...match, ...reviewFilter })
      .select("rating")
      .session(session)
      .lean();
    await Model.updateOne(
      filter,
      {
        $set: {
          rating: rows.length
            ? rows.reduce((n, r) => n + r.rating, 0) / rows.length
            : 0,
          reviewsCount: rows.length,
        },
      },
      { session },
    );
  }
  // Only published public text is copied; private survey content is never included.
  const publicRows = await Review.find({
    trip: tripId,
    moderationStatus: "published",
    isVisible: true,
  })
    .sort({ createdAt: -1 })
    .limit(12)
    .session(session)
    .lean();
  await Trip.updateOne(
    { _id: tripId },
    {
      $set: {
        reviews: publicRows.map((r) => ({
          name: r.provenance === "demo" ? "Demo traveler" : "Traveler",
          date: new Date(r.createdAt).toISOString().slice(0, 10),
          text: r.comment.slice(0, 1000),
          rating: r.rating,
        })),
      },
    },
    { session },
  );
}
export async function submitExperienceReview(
  actor,
  bookingId,
  input,
  survey = {},
) {
  return atomic(async (session) => {
    const b = await Booking.findById(bookingId).session(session);
    demand(
      b && sameId(b.tourist, actor) && actor.role === "tourist",
      "Booking access denied",
      403,
    );
    const o = await Occurrence.findById(b.occurrence).session(session);
    demand(
      reviewEligible(b, o),
      "Paid completed attendance is required within 14 days",
      403,
      "REVIEW_NOT_ELIGIBLE",
    );
    const existing = await Review.findOne({ booking: b._id }).session(session);
    if (existing) return existing;
    const [review] = await Review.create(
      [
        {
          ...input,
          booking: b._id,
          trip: b.trip,
          guide: b.guide,
          tourist: actor._id,
          isVerifiedBooking: true,
          provenance: "verified",
          moderationStatus: "pending_moderation",
          isVisible: false,
        },
      ],
      { session },
    );
    const allowed = [
      "overall",
      "knowledge",
      "communication",
      "punctuality",
      "safety",
      "value",
      "matchedListing",
      "wouldRecommend",
      "hadProblem",
      "privateFeedback",
    ];
    const privateData = Object.fromEntries(
      allowed.filter((k) => survey[k] !== undefined).map((k) => [k, survey[k]]),
    );
    if (Object.keys(privateData).length)
      await PrivateExperienceSurvey.create(
        [
          {
            booking: b._id,
            guide: b.guide,
            tourist: actor._id,
            ...privateData,
          },
        ],
        { session },
      );
    if (Object.keys(privateData).length) {
      const metrics = await qualityMetrics(b.guide, {
        includePrivate: true,
        session,
      });
      await GuideProfile.updateOne(
        { user: b.guide },
        { $set: { internalQualityScore: metrics.internalQualityScore } },
        { session },
      );
      if (privateData.hadProblem || privateData.safety <= 2)
        await OperationalCase.updateOne(
          { key: `survey:${b._id}` },
          {
            $setOnInsert: {
              key: `survey:${b._id}`,
              type: "safety",
              booking: b._id,
              occurrence: b.occurrence,
              openedBy: actor._id,
              report:
                "Private survey indicates an issue. Authorized admin must review the confidential survey.",
            },
          },
          { upsert: true, session },
        );
    }
    await audit(session, actor, "review_submitted", "Review", review);
    return review;
  });
}
const REASONS = [
  "spam",
  "fake_content",
  "abuse",
  "threats",
  "personal_information",
  "irrelevant",
  "fraud",
  "prohibited_content",
  "policy_violation",
];
export async function moderateReview(id, action, actor, reason = "") {
  demand(actor.role === "admin", "Admin required", 403);
  return atomic(async (session) => {
    const review = await Review.findById(id).session(session);
    demand(review, "Review not found", 404);
    const before = { moderationStatus: review.moderationStatus };
    demand(
      ["publish", "reject", "hide"].includes(action),
      "Unknown moderation action",
      400,
    );
    if (action === "publish")
      demand(
        ["pending_moderation", "hidden"].includes(review.moderationStatus),
        "Review cannot be published from this state",
      );
    else {
      demand(
        REASONS.includes(reason),
        "Select a policy reason; negative ratings are not a reason",
        400,
      );
      demand(
        action === "hide"
          ? review.moderationStatus === "published"
          : review.moderationStatus === "pending_moderation",
        "Invalid review transition",
      );
    }
    review.moderationStatus = {
      publish: "published",
      reject: "rejected",
      hide: "hidden",
    }[action];
    review.isVisible = action === "publish";
    review.moderationReason = reason;
    review.moderatedBy = actor._id;
    review.moderatedAt = new Date();
    await review.save({ session });
    await recomputeRatings(review.trip, review.guide, session);
    await audit(
      session,
      actor,
      `review_${action}`,
      "Review",
      review,
      before,
      reason,
    );
    await enqueue(
      session,
      `review:${id}:${review.updatedAt.toISOString()}`,
      "notification",
      {
        user: String(review.tourist),
        type: "review",
        title: "Review moderation",
        message: `Your review is ${review.moderationStatus}.`,
        link: "/user/profile/reviews",
        entityType: "review",
        entityId: String(review._id),
      },
    );

    if (action === "publish")
      await enqueue(
        session,
        `guide-review-published:${id}:${review.updatedAt.toISOString()}`,
        "notification",
        {
          user: String(review.guide),
          type: "review",
          title: "New review published",
          message: "A traveler review is now live on your guide profile.",
          link: "/guide/reviews",
          entityType: "review",
          entityId: String(review._id),
        },
      );

    return review;
  });
}
export async function editReview(id, actor, input, withdraw = false) {
  return atomic(async (session) => {
    const r = await Review.findOne({ _id: id, tourist: actor._id }).session(
      session,
    );
    demand(r, "Review not found", 404);
    if (!withdraw) {
      const b = await Booking.findById(r.booking).session(session),
        o = await Occurrence.findById(b?.occurrence).session(session);
      demand(reviewEligible(b, o), "Review edit window or eligibility expired");
      Object.assign(r, input);
    }
    const before = { moderationStatus: r.moderationStatus };
    r.moderationStatus = withdraw ? "hidden" : "pending_moderation";
    r.isVisible = false;
    await r.save({ session });
    await recomputeRatings(r.trip, r.guide, session);
    await audit(
      session,
      actor,
      withdraw ? "review_withdrawn" : "review_edited",
      "Review",
      r,
      before,
    );
    return r;
  });
}
