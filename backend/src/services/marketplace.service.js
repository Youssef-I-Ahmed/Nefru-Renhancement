import mongoose from "mongoose";
import { Trip } from "../models/trip.model.js";
import { User } from "../models/user.model.js";
import { GuideProfile } from "../models/guide.model.js";
import { Booking } from "../models/booking.model.js";
import { BookingSeat } from "../models/bookingSeat.model.js";
import { TripRevision } from "../models/tripRevision.model.js";
import { Occurrence } from "../models/occurrence.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { OperationalCase } from "../models/operationalCase.model.js";
import { DomainJob } from "../models/domainJob.model.js";
import { GuideVerification } from "../models/guideVerification.model.js";
import {
  demand,
  sameId,
  tripState,
  transitionTrip,
  CONTENT_FIELDS,
  accountActive,
  verificationValid,
  cancellationEntitlement,
} from "../domain/policies.js";
import {
  normalizeTripSchedule,
  occurrenceDateTime,
} from "../utils/tripSchedule.js";

export async function atomic(work) {
  try {
    return await mongoose.connection.transaction(work);
  } catch (error) {
    if (error.code === 11000)
      demand(
        false,
        "A conflicting record already exists; refresh and retry",
        409,
        "CONFLICT",
      );
    if (error.name === "VersionError")
      demand(false, "Record changed; refresh and retry", 409, "CONFLICT");
    throw error;
  }
}
export function stateSummary(doc) {
  return Object.fromEntries(
    [
      "featured",
      "attendance",
      "lifecycleStatus",
      "reviewStatus",
      "publishedVersion",
      "status",
      "accountStatus",
      "identityStatus",
      "licenseStatus",
      "moderationStatus",
    ]
      .filter((k) => doc[k] !== undefined)
      .map((k) => [k, doc[k]]),
  );
}
export async function audit(
  session,
  actor,
  action,
  type,
  doc,
  before = {},
  reason = "",
) {
  const [event] = await AuditLog.create(
    [
      {
        action,
        entityType: type,
        entityId: doc._id,
        performedBy: actor?._id || null,
        performedByRole: actor?.role || "system",
        reason: String(reason).slice(0, 1000),
        before,
        after: stateSummary(doc),
      },
    ],
    { session },
  );
  return event;
}
export async function enqueue(session, key, type, payload, dueAt = new Date()) {
  await DomainJob.updateOne(
    { key },
    { $setOnInsert: { key, type, payload, dueAt } },
    { upsert: true, session },
  );
}
export async function signal(
  session,
  actor,
  action,
  type,
  doc,
  recipient,
  before = {},
  reason = "",
) {
  const event = await audit(session, actor, action, type, doc, before, reason);
  const recipientUser = recipient
    ? await User.findById(recipient).select("role").session(session)
    : null;
  const message =
    `${action.replaceAll("_", " ")}: ${reason || "Your experience status has changed."}`.slice(
      0,
      500,
    );
  if (recipientUser)
    await enqueue(session, `event:${event._id}`, "notification", {
      user: String(recipient),
      title: "NEFRU update",
      message,
      link:
        recipientUser.role === "tourist"
          ? "/user/profile/bookings"
          : "/guide/operations",
    });
  if (recipientUser)
    await enqueue(session, `mail:${event._id}`, "email", {
      user: String(recipient),
      title: "NEFRU update",
      message,
    });
}
export async function eligibleGuide(id, trip = {}, session = null) {
  const user = await User.findById(id).session(session);
  const profile = await GuideProfile.findOne({ user: id }).session(session);
  demand(
    accountActive(user) &&
      user.role === "guide" &&
      verificationValid(profile, { licenseRequired: trip.licenseRequired }),
    "Guide account or required verification is not eligible",
    403,
    "GUIDE_INELIGIBLE",
  );
  return profile;
}
export async function assertBookable(trip, session = null) {
  demand(
    tripState(trip).lifecycleStatus === "live" &&
      tripState(trip).reviewStatus === "approved",
    "Experience is not accepting new bookings",
  );
  demand(
    trip.currency === "EGP",
    "Experience requires currency migration",
    409,
  );
  await eligibleGuide(trip.guide, trip, session);
}
export function contentOf(value) {
  return Object.fromEntries(
    CONTENT_FIELDS.filter((k) => value[k] !== undefined).map((k) => [
      k,
      value[k],
    ]),
  );
}
export async function validatedContent(trip, input) {
  demand(
    input.currency === undefined || input.currency === "EGP",
    "Only EGP is accepted",
    400,
  );
  const content = {
    ...contentOf(trip.toObject ? trip.toObject() : trip),
    ...contentOf(input),
  };
  for (const key of [
    "lifecycleStatus",
    "reviewStatus",
    "status",
    "guide",
    "publishedVersion",
    "rating",
    "reviewsCount",
  ])
    demand(
      input[key] === undefined,
      "Use an explicit action for protected fields",
      400,
    );
  const rawSlots = [
    ...(content.schedule?.slots || []),
    ...Object.values(content.schedule?.slotsByDate || {}).flat(),
  ];
  for (const slot of rawSlots) {
    for (const time of [slot.startTime, slot.endTime])
      demand(
        typeof time === "string" &&
          (/^([01]?\d|2[0-3]):[0-5]\d$/.test(time) ||
            /^(0?[1-9]|1[0-2]):[0-5]\d\s*[ap]m$/i.test(time)),
        "Invalid raw schedule time",
        400,
      );
    demand(
      Number.isInteger(Number(slot.capacity ?? content.groupSize)) &&
        Number(slot.capacity ?? content.groupSize) > 0,
      "Invalid raw capacity",
      400,
    );
    if (slot.id)
      demand(
        /^[a-zA-Z0-9_-]{1,80}$/.test(slot.id),
        "Invalid slot identifier",
        400,
      );
  }
  demand(
    Number.isFinite(Number(content.price)) && Number(content.price) > 0,
    "Price must be positive EGP",
    400,
  );
  demand(
    Number.isInteger(Number(content.groupSize)) &&
      Number(content.groupSize) > 0,
    "Capacity must be a positive integer",
    400,
  );
  if (content.highlights)
    content.highlights = content.highlights.map((item) =>
      typeof item === "string" ? { title: item } : item,
    );
  const schedule = normalizeTripSchedule(content.schedule, content.groupSize);
  const keys = new Set();
  for (const slot of schedule.slots) {
    demand(
      /^\d{4}-\d{2}-\d{2}$/.test(slot.date) &&
        new Date(`${slot.date}T12:00Z`).toISOString().slice(0, 10) ===
          slot.date,
      "Invalid schedule date",
      400,
    );
    demand(
      /^([01]\d|2[0-3]):[0-5]\d$/.test(slot.startTime) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(slot.endTime) &&
        slot.endTime > slot.startTime,
      "Invalid start/end time",
      400,
    );
    demand(
      Number.isInteger(slot.capacity) &&
        slot.capacity > 0 &&
        slot.capacity <= 1000,
      "Invalid capacity",
      400,
    );
    demand(!keys.has(slot.occurrenceKey), "Duplicate occurrence key", 400);
    keys.add(slot.occurrenceKey);
  }
  content.schedule = schedule;
  const candidate = new Trip({
    ...content,
    guide: trip.guide,
    currency: "EGP",
  });
  await candidate.validate();
  return contentOf(candidate.toObject());
}
export async function syncOccurrences(trip, session) {
  const slots = normalizeTripSchedule(trip.schedule, trip.groupSize).slots;
  const existing = await Occurrence.find({ trip: trip._id }).session(session);
  const historicalKeys = new Set();
  for (const old of existing) {
    if (
      old.status === "completed" ||
      (await Booking.exists({
        occurrence: old._id,
        status: "completed",
      }).session(session))
    ) {
      historicalKeys.add(old.occurrenceKey);
      continue; // A new schedule does not rewrite or remove delivered occurrences.
    }
    const slot = slots.find((s) => s.occurrenceKey === old.occurrenceKey);
    const booked = await Booking.exists({
      trip: trip._id,
      occurrenceKey: old.occurrenceKey,
      status: { $in: ["confirmed", "completed", "pending_payment"] },
    }).session(session);
    if (booked)
      demand(
        slot &&
          slot.capacity >= old.capacity &&
          +occurrenceDateTime(slot.date, slot.startTime) === +old.startsAt &&
          +occurrenceDateTime(slot.date, slot.endTime) === +old.endsAt,
        "Booked occurrences cannot be removed, moved, shortened or reduced",
      );
    if (!slot && old.status === "upcoming") {
      old.status = "cancelled";
      await old.save({ session });
    }
  }
  for (const slot of slots) {
    const old = existing.find((o) => o.occurrenceKey === slot.occurrenceKey);
    if (
      historicalKeys.has(slot.occurrenceKey) ||
      (old && old.status !== "upcoming")
    )
      continue;
    await Occurrence.updateOne(
      { trip: trip._id, occurrenceKey: slot.occurrenceKey },
      {
        $set: {
          guide: trip.guide,
          startsAt: occurrenceDateTime(slot.date, slot.startTime),
          endsAt: occurrenceDateTime(slot.date, slot.endTime),
          capacity: slot.capacity,
          publishedVersion: trip.publishedVersion,
        },
        $setOnInsert: { status: "upcoming" },
      },
      { upsert: true, session, runValidators: true },
    );
  }
}
export async function actOnTrip(id, action, actor, reason = "") {
  return atomic(async (session) => {
    const trip = await Trip.findById(id).select("+moderation").session(session);
    demand(trip, "Trip not found", 404);
    const before = tripState(trip);
    const next = transitionTrip(trip, action, actor, reason);
    if (["approve", "resume", "submit"].includes(action)) {
      await eligibleGuide(trip.guide, trip, session);
      const content = await validatedContent(trip, {});
      demand(
        content.image &&
          content.schedule.slots.some(
            (s) => occurrenceDateTime(s.date, s.startTime) > new Date(),
          ),
        "Image and future schedule required",
      );
    }
    Object.assign(trip, next);
    if (action === "approve") {
      trip.publishedVersion = Math.max(1, trip.publishedVersion || 0);
      await syncOccurrences(trip, session);
    }
    const legacyAction = {
      submit: "submitted",
      approve: "published",
      request_changes: "changes_requested",
      reject: "rejected",
      hide: "hidden",
    }[action];
    if (legacyAction) {
      trip.moderation.lastAction = legacyAction;
      trip.moderation.reason = reason;
      trip.moderation.reviewedAt = new Date();
      trip.moderation.reviewedBy = actor._id;
      trip.moderation.history.push({
        action: legacyAction,
        reason,
        reviewedAt: new Date(),
        reviewedBy: actor._id,
      });
    }
    await trip.save({ session });
    await signal(
      session,
      actor,
      action,
      "Trip",
      trip,
      trip.guide,
      before,
      reason,
    );
    return trip;
  });
}
export async function editTrip(id, input, actor) {
  demand(
    input.currency === undefined || input.currency === "EGP",
    "Only EGP is accepted",
    400,
  );
  for (const key of [
    "status",
    "lifecycleStatus",
    "reviewStatus",
    "guide",
    "rating",
    "publishedVersion",
  ])
    demand(input[key] === undefined, "Use explicit business actions", 400);
  return atomic(async (session) => {
    const trip = await Trip.findById(id)
      .select("+moderation +imagePublicId +galleryPublicIds")
      .session(session);
    demand(trip, "Trip not found", 404);
    demand(
      actor.role === "guide" && sameId(trip.guide, actor),
      "Trip ownership required",
      403,
    );
    const state = tripState(trip);
    demand(
      !["archived", "hidden_by_admin"].includes(state.lifecycleStatus),
      "Experience is restricted",
    );
    if (state.lifecycleStatus === "draft") {
      demand(
        ["not_submitted", "changes_requested"].includes(state.reviewStatus),
        "Withdrawn/rejected/in-review content is locked",
      );
      Object.assign(trip, await validatedContent(trip, input), state);
      await trip.save({ session });
      await audit(session, actor, "draft_saved", "Trip", trip);
      return trip.toObject();
    }
    let revision = await TripRevision.findOne({ trip: id, open: true }).session(
      session,
    );
    demand(
      !revision ||
        ["draft", "changes_requested"].includes(revision.reviewStatus),
      "Revision is currently in review",
    );
    const content = await validatedContent(trip, {
      ...(revision?.content || {}),
      ...contentOf(input),
    });
    if (!revision)
      revision = new TripRevision({
        trip: id,
        guide: actor._id,
        baseVersion: trip.publishedVersion || 1,
        content,
      });
    else {
      revision.content = content;
      revision.reviewStatus = "draft";
    }
    await revision.save({ session });
    await audit(session, actor, "revision_saved", "TripRevision", revision);
    return {
      ...trip.toObject(),
      ...content,
      revisionId: revision._id,
      revisionStatus: revision.reviewStatus,
    };
  });
}
export async function actOnRevision(id, action, actor, reason = "") {
  return atomic(async (session) => {
    const revision = await TripRevision.findById(id).session(session);
    demand(revision, "Revision not found", 404);
    const trip = await Trip.findById(revision.trip).session(session);
    demand(trip, "Trip not found", 404);
    demand(
      actor.role === "admin" ||
        (actor.role === "guide" && sameId(revision.guide, actor)),
      "Revision access denied",
      403,
    );
    demand(revision.open, "Revision is already closed");
    const before = stateSummary(revision);
    if (action === "submit") {
      demand(
        ["draft", "changes_requested"].includes(revision.reviewStatus),
        "Revision cannot be submitted",
      );
      await eligibleGuide(trip.guide, revision.content, session);
      revision.reviewStatus = "in_review";
    } else {
      demand(actor.role === "admin", "Admin action required", 403);
      demand(
        revision.reviewStatus === "in_review",
        "Revision is not in review",
      );
      demand(
        ["approve", "reject", "request_changes"].includes(action),
        "Unknown revision action",
        400,
      );
      if (action !== "approve")
        demand(reason.trim().length >= 3, "Reason required", 400);
      if (action === "approve") {
        await eligibleGuide(trip.guide, revision.content, session);
        demand(
          ["live", "paused_by_guide"].includes(tripState(trip).lifecycleStatus),
          "Trip is restricted",
        );
        demand(
          (trip.publishedVersion || 1) === revision.baseVersion,
          "Revision is based on an outdated version",
        );
        // Booked contracts cannot have material venue/duration changes silently applied.
        const future = await Booking.exists({
          trip: trip._id,
          date: { $gt: new Date() },
          status: { $in: ["confirmed", "pending_payment"] },
        }).session(session);
        if (future)
          demand(
            revision.content.location === trip.location &&
              revision.content.duration === trip.duration &&
              JSON.stringify(revision.content.coordinates) ===
                JSON.stringify(
                  trip.coordinates?.toObject?.() || trip.coordinates,
                ),
            "Resolve future bookings before changing location or duration",
          );
        Object.assign(trip, await validatedContent(trip, revision.content));
        trip.publishedVersion = (trip.publishedVersion || 1) + 1;
        await syncOccurrences(trip, session);
        await trip.save({ session });
        revision.reviewStatus = "approved";
        revision.open = false;
      } else {
        revision.reviewStatus =
          action === "reject" ? "rejected" : "changes_requested";
        revision.open = action !== "reject";
      }
      revision.reason = reason;
      revision.reviewedAt = new Date();
      revision.reviewedBy = actor._id;
    }
    await revision.save({ session });
    await signal(
      session,
      actor,
      `revision_${action}`,
      "TripRevision",
      revision,
      revision.guide,
      before,
      reason,
    );
    return revision;
  });
}
export async function actOnOccurrence(id, action, actor, reason = "") {
  return atomic(async (session) => {
    const occurrence = await Occurrence.findById(id).session(session);
    demand(occurrence, "Occurrence not found", 404);
    demand(
      actor.role === "admin" ||
        (actor.role === "guide" && sameId(occurrence.guide, actor)),
      "Occurrence access denied",
      403,
    );
    const now = new Date();
    const before = stateSummary(occurrence);
    if (["start", "open_check_in"].includes(action)) {
      await eligibleGuide(
        occurrence.guide,
        await Trip.findById(occurrence.trip).session(session),
        session,
      );
      const early = Number(process.env.OCCURRENCE_EARLY_MINUTES) || 30,
        late = Number(process.env.OCCURRENCE_LATE_MINUTES) || 60;
      demand(
        now >= new Date(+occurrence.startsAt - early * 60000) &&
          now <= new Date(+occurrence.startsAt + late * 60000),
        "Outside allowed start window",
      );
      demand(
        ["upcoming", "check_in_open"].includes(occurrence.status),
        "Occurrence already started or closed",
      );
      occurrence.status = action === "start" ? "in_progress" : "check_in_open";
      if (action === "start") {
        occurrence.actualStartedAt = now;
        occurrence.startedBy = actor._id;
      }
    } else if (action === "end") {
      demand(
        occurrence.status === "in_progress" && now >= occurrence.endsAt,
        "Occurrence must be started and scheduled end reached",
      );
      occurrence.status = "completed";
      occurrence.actualEndedAt = now;
      occurrence.endedBy = actor._id;
      occurrence.completionSource = "guide";
      const bookings = await Booking.find({
        occurrence: id,
        status: "confirmed",
      }).session(session);
      for (const b of bookings) {
        b.status = "completed";
        b.completedAt = now;
        b.earningsAvailableAt = new Date(
          +now + (b.policySnapshot?.disputeWindowHours ?? 24) * 3600000,
        );
        await b.save({ session });
        await BookingSeat.deleteOne({ booking: b._id }, { session });
        if (b.attendance?.status === "checked_in" && b.paymentStatus === "paid")
          await enqueue(
            session,
            `review-invite:${b._id}`,
            "review_invitation",
            { booking: String(b._id) },
            new Date(+now + 45 * 60000),
          );
      }
    } else if (action === "cancel") {
      demand(
        ["upcoming", "check_in_open"].includes(occurrence.status),
        "Occurrence cannot be cancelled in this state",
      );
      demand(reason.trim().length >= 3, "Reason required", 400);
      occurrence.status = "cancelled";
      const bookings = await Booking.find({
        occurrence: id,
        status: { $in: ["confirmed", "pending_payment"] },
      }).session(session);
      for (const b of bookings) {
        b.status = "cancelled";
        b.cancelledBy = actor.role;
        b.cancelledAt = now;
        b.cancellationReason = reason;
        b.holdExpiresAt = null;
        b.refundEntitlement = cancellationEntitlement(b, actor.role, now);
        await b.save({ session });
        await BookingSeat.deleteOne({ booking: b._id }, { session });
        await signal(
          session,
          actor,
          "booking_cancelled",
          "Booking",
          b,
          b.tourist,
          {},
          reason,
        );
      }
    } else demand(false, "Unknown occurrence action", 400);
    await occurrence.save({ session });
    await audit(
      session,
      actor,
      action,
      "Occurrence",
      occurrence,
      before,
      reason,
    );
    return occurrence;
  });
}
export async function attendanceAction(id, action, actor, reason = "") {
  return atomic(async (session) => {
    const b = await Booking.findById(id).session(session);
    demand(b, "Booking not found", 404);
    const o = await Occurrence.findById(b.occurrence).session(session);
    demand(o, "Occurrence evidence missing");
    demand(
      ["confirmed", "completed"].includes(b.status) &&
        b.paymentStatus === "paid",
      "Only paid participants have attendance",
    );
    const previous = b.attendance?.status || "booked";
    if (action === "dispute") {
      demand(
        actor.role === "tourist" && sameId(b.tourist, actor),
        "Booking ownership required",
        403,
      );
      demand(
        ["no_show", "booked"].includes(previous) && new Date() >= o.startsAt,
        "Attendance cannot be disputed yet",
      );
      demand(reason.trim().length >= 3, "Describe the attendance issue", 400);
      await OperationalCase.updateOne(
        { key: `attendance:${id}` },
        {
          $setOnInsert: {
            key: `attendance:${id}`,
            type: "attendance_dispute",
            booking: id,
            occurrence: o._id,
            openedBy: actor._id,
            report: reason,
          },
        },
        { upsert: true, session },
      );
      b.attendance.status = "attendance_disputed";
    } else {
      demand(
        actor.role === "guide" && sameId(b.guide, actor),
        "Guide ownership required",
        403,
      );
      demand(o.status === "in_progress", "Experience must be in progress");
      demand(
        ["check_in", "no_show"].includes(action) && previous === "booked",
        "Attendance is already recorded",
      );
      if (action === "no_show")
        demand(
          new Date() >= new Date(+o.startsAt + 30 * 60000),
          "No-show grace period has not elapsed",
        );
      b.attendance.status = action === "check_in" ? "checked_in" : "no_show";
    }
    b.attendance.markedAt = new Date();
    b.attendance.markedBy = actor._id;
    await b.save({ session });
    await audit(
      session,
      actor,
      action,
      "Booking",
      b,
      { attendance: previous },
      reason,
    );
    return { id: b._id, attendance: b.attendance };
  });
}
export async function accountAction(id, action, actor, reason = "") {
  return atomic(async (session) => {
    const user = await User.findById(id)
      .select("+tokenVersion")
      .session(session);
    demand(user, "Account not found", 404);
    const admin = ["suspend", "restore", "close"].includes(action);
    demand(
      admin
        ? actor.role === "admin"
        : sameId(user, actor) ||
            (action === "request_deletion" && actor.role === "admin"),
      "Account access denied",
      403,
    );
    demand(
      user.role !== "admin",
      "Admin accounts require an operator workflow",
      403,
    );
    const before = {
      accountStatus:
        user.accountStatus ||
        (user.status === "active" ? "active" : "suspended_by_admin"),
    };
    const targets = {
      suspend: "suspended_by_admin",
      restore: "active",
      deactivate: "deactivated_by_user",
      request_deletion: "deletion_requested",
      close: "closed",
    };
    demand(targets[action], "Unknown account action", 400);
    if (before.accountStatus === targets[action])
      return { id: user._id, accountStatus: user.accountStatus };
    if (action === "restore")
      demand(
        before.accountStatus === "suspended_by_admin",
        "Only suspended accounts may be restored",
      );
    if (["suspend", "close"].includes(action))
      demand(reason.trim().length >= 3, "Reason required", 400);
    demand(
      !["closed", "anonymized"].includes(before.accountStatus),
      "Account is closed",
    );
    if (action === "close") {
      demand(
        before.accountStatus === "deletion_requested",
        "Deletion must be requested first",
      );
      demand(!user.legalHold && !user.operationalHold, "Account is on hold");
      const obligations = await Booking.exists({
        $or: [{ guide: id }, { tourist: id }],
        $and: [
          {
            $or: [
              { status: { $in: ["pending_payment", "confirmed"] } },
              {
                guide: id,
                paymentStatus: "paid",
                settlementStatus: { $ne: "settled" },
                guideEarnings: { $gt: 0 },
              },
            ],
          },
        ],
      }).session(session);
      demand(
        !obligations,
        "Resolve bookings and unsettled earnings before closure",
      );
    }
    user.accountStatus = targets[action];
    user.status = action === "restore" ? "active" : "deactivated";
    user.statusSource = actor.role === "admin" ? "admin" : "user";
    user.statusReason = reason;
    user.statusChangedAt = new Date();
    user.statusChangedBy = actor._id;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save({ session });
    await audit(session, actor, action, "User", user, before, reason);
    return { id: user._id, accountStatus: user.accountStatus };
  });
}
export async function verificationAction(id, action, actor, input = {}) {
  demand(actor.role === "admin", "Admin required", 403);
  return atomic(async (session) => {
    const profile = await GuideProfile.findOne({ user: id }).session(session);
    demand(profile, "Guide not found", 404);
    const verification = await GuideVerification.findOne({
      guideProfile: profile._id,
    })
      .select("+documents +reviewHistory")
      .session(session);
    demand(verification, "Verification documents required");
    const type = input.kind === "license" ? "license" : "identity";
    const field = type === "license" ? "licenseStatus" : "identityStatus";
    const submitted =
      verification[type + "SubmittedAt"] ||
      (type === "identity" ? verification.submittedAt : null);
    const reviewed =
      verification[type + "ReviewedAt"] ||
      (type === "identity" ? verification.reviewedAt : null);
    demand(
      submitted && (!reviewed || submitted > reviewed),
      "Verification has not been submitted",
    );
    demand(
      ["pending", "renewal_in_review"].includes(
        profile[field] || profile.verificationStatus,
      ),
      "Only submitted verification can be reviewed",
    );
    const before = stateSummary(profile);
    demand(
      ["approve", "reject"].includes(action),
      "Invalid verification action",
      400,
    );
    const documents = verification.documents.filter((d) =>
      type === "license"
        ? d.documentType === "guide_license"
        : ["national_id", "passport"].includes(d.documentType),
    );
    if (action === "approve") {
      demand(documents.length > 0, "Required document missing");
      const expiry = input.expiryDate ? new Date(input.expiryDate) : null;
      demand(
        type !== "license" || (expiry && expiry > new Date()),
        "Valid license expiry required",
        400,
      );
      if (expiry)
        demand(expiry > new Date(), "Expiry must be in the future", 400);
      profile[field] = "approved";
      profile[type === "license" ? "licenseExpiresAt" : "identityExpiresAt"] =
        expiry;
    } else {
      demand(
        String(input.reason || input.rejectionReason || "").trim().length >= 3,
        "Reason required",
        400,
      );
      profile[field] = "rejected";
    }
    if (type === "identity") profile.verificationStatus = profile[field];
    verification[type + "ReviewedAt"] = new Date();
    verification.reviewedAt = new Date();
    verification.reviewedBy = actor._id;
    verification.reviewHistory.push({
      status: profile[field],
      reason: type + ": " + String(input.reason || input.rejectionReason || ""),
      reviewedAt: new Date(),
      reviewedBy: actor._id,
    });
    await profile.save({ session });
    await verification.save({ session });
    await signal(
      session,
      actor,
      `${type}_${action}`,
      "GuideProfile",
      profile,
      id,
      before,
      input.reason || input.rejectionReason || "",
    );
    return {
      verificationStatus: profile.verificationStatus,
      identityStatus: profile.identityStatus,
      licenseStatus: profile.licenseStatus,
    };
  });
}

export async function submitGuideVerification(actor, kind = "identity") {
  demand(actor.role === "guide", "Guide required", 403);
  return atomic(async (session) => {
    const profile = await GuideProfile.findOne({ user: actor._id }).session(
      session,
    );
    demand(profile, "Guide profile not found", 404);
    const verification = await GuideVerification.findOne({
      guideProfile: profile._id,
    })
      .select("+documents +requestedChanges +reviewHistory")
      .session(session);
    demand(verification, "Documents required");
    demand(
      ["identity", "license"].includes(kind),
      "Unknown verification type",
      400,
    );
    const field = kind === "license" ? "licenseStatus" : "identityStatus";
    const previous = profile[field] || profile.verificationStatus;
    const reviewed =
      verification[kind + "ReviewedAt"] ||
      (kind === "identity" ? verification.reviewedAt : null);
    const submitted =
      verification[kind + "SubmittedAt"] ||
      (kind === "identity" ? verification.submittedAt : null);
    demand(
      [
        "draft",
        "pending",
        "approved",
        "expiring_soon",
        "expired",
        "rejected",
      ].includes(previous),
      "Verification already under review",
    );
    const docs = verification.documents.filter((d) =>
      kind === "license"
        ? d.documentType === "guide_license"
        : ["national_id", "passport"].includes(d.documentType),
    );
    demand(docs.length, "Required document missing");
    if (
      ["approved", "expiring_soon", "expired", "rejected"].includes(previous) &&
      reviewed
    )
      demand(
        docs.some((d) => new Date(d.replacedAt || d.uploadedAt) > reviewed),
        "Upload a renewed/replacement document first",
      );
    demand(
      !submitted || (reviewed && submitted <= reviewed),
      "Verification is already pending review",
    );
    demand(
      !verification.requestedChanges.some((c) => !c.resolvedAt),
      "Resolve requested document changes",
    );
    profile[field] = ["approved", "expiring_soon", "expired"].includes(previous)
      ? "renewal_in_review"
      : "pending";
    if (kind === "identity" && profile[field] === "pending")
      profile.verificationStatus = "pending";
    verification[kind + "SubmittedAt"] = new Date();
    verification.submittedAt = new Date();
    await profile.save({ session });
    await verification.save({ session });
    await signal(
      session,
      actor,
      "verification_submitted",
      "GuideProfile",
      profile,
      actor._id,
      { [field]: previous },
    );
    return {
      verificationStatus: profile.verificationStatus,
      identityStatus: profile.identityStatus,
      licenseStatus: profile.licenseStatus,
    };
  });
}
