import { DomainJob } from "../models/domainJob.model.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { Booking } from "../models/booking.model.js";
import { Occurrence } from "../models/occurrence.model.js";
import { GuideProfile } from "../models/guide.model.js";
import { OperationalCase } from "../models/operationalCase.model.js";
import { Review } from "../models/review.model.js";
import { atomic, audit, enqueue } from "./marketplace.service.js";
import { reviewEligible } from "../domain/policies.js";
import { sendTransactionalEmail } from "./mail.service.js";
import { env } from "../config/env.js";
import { expireHolds } from "./reservation.service.js";
import { BookingSeat } from "../models/bookingSeat.model.js";

export async function runDueJob(now = new Date()) {
  const job = await DomainJob.findOneAndUpdate(
    {
      completedAt: null,
      dueAt: { $lte: now },
      $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }],
    },
    { $set: { lockedUntil: new Date(+now + 300000) }, $inc: { attempts: 1 } },
    { sort: { dueAt: 1 }, new: true },
  );
  if (!job) return false;
  try {
    if (job.type === "notification")
      await Notification.updateOne(
        { eventKey: job.key },
        { $setOnInsert: { ...job.payload, eventKey: job.key, type: "system" } },
        { upsert: true, runValidators: true },
      );
    if (job.type === "email") {
      const user = await User.findById(job.payload.user).select("email");
      if (user && !user.email.endsWith("@demo.example.com"))
        await sendTransactionalEmail({
          to: user.email,
          template: "state-change",
          data: job.payload,
        });
    }
    if (job.type === "review_invitation") {
      const b = await Booking.findById(job.payload.booking),
        o = b ? await Occurrence.findById(b.occurrence) : null;
      if (reviewEligible(b, o) && !(await Review.exists({ booking: b._id }))) {
        await Notification.updateOne(
          { eventKey: job.key },
          {
            $setOnInsert: {
              eventKey: job.key,
              user: b.tourist,
              type: "review",
              title: "How was your experience?",
              message: "Share your feedback with NEFRU.",
              link: "/user/profile/reviews",
            },
          },
          { upsert: true },
        );
        const u = await User.findById(b.tourist).select("email");
        if (u && !u.email.endsWith("@demo.example.com"))
          await sendTransactionalEmail({
            to: u.email,
            template: "review-invitation",
            data: {
              message: "Share your experience and private feedback.",
              url: env.frontendUrl + "/user/profile/reviews",
              cta: "Share your feedback",
            },
          });
        if (job.key === `review-invite:${b._id}`)
          for (const hours of [24, 72])
            await enqueue(
              null,
              `review-reminder:${b._id}:${hours}`,
              "review_invitation",
              { booking: String(b._id) },
              new Date(+o.actualEndedAt + hours * 3600000),
            );
      }
    }
    await DomainJob.updateOne(
      { _id: job._id, lockedUntil: job.lockedUntil },
      { $set: { completedAt: new Date(), lockedUntil: null, lastError: "" } },
    );
  } catch {
    await DomainJob.updateOne(
      { _id: job._id, lockedUntil: job.lockedUntil },
      {
        $set: {
          lockedUntil: null,
          dueAt: new Date(
            Date.now() +
            Math.min(3600000, 2 ** Math.min(job.attempts, 10) * 30000),
          ),
          lastError: "Delivery failed; retry scheduled",
        },
      },
    );
  }
  return true;
}
export async function reconcileDomainTime(now = new Date()) {
  await expireHolds();
  const profiles = await GuideProfile.find({
    $or: [
      { identityExpiresAt: { $ne: null } },
      { licenseExpiresAt: { $ne: null } },
    ],
  })
    .select("_id")
    .lean();
  for (const row of profiles)
    await atomic(async (session) => {
      const p = await GuideProfile.findById(row._id).session(session);
      const before = {
        identityStatus: p.identityStatus,
        licenseStatus: p.licenseStatus,
      };
      let changed = false;
      for (const kind of ["identity", "license"]) {
        const expiry = p[kind + "ExpiresAt"],
          field = kind + "Status";
        if (
          !expiry ||
          !["approved", "expiring_soon", "renewal_in_review"].includes(p[field])
        )
          continue;
        if (expiry <= now) {
          p[field] = "expired";
          changed = true;
          await enqueue(
            session,
            `${kind}-expired:${p._id}:${+expiry}`,
            "notification",
            {
              user: String(p.user),
              title: "Verification expired",
              message:
                "Renew the required verification. Existing bookings need separate operational review.",
              link: "/guide/verification",
            },
          );
        } else
          for (const days of [7, 14, 30])
            if (expiry - now <= days * 86400000) {
              if (p[field] === "approved") {
                p[field] = "expiring_soon";
                changed = true;
              }
              await enqueue(
                session,
                `${kind}-expiry:${p._id}:${+expiry}:${days}`,
                "notification",
                {
                  user: String(p.user),
                  title: "Verification renewal reminder",
                  message: `Your ${kind} verification expires within ${days} days.`,
                  link: "/guide/verification",
                },
              );
              break;
            }
      }
      if (changed) {
        await p.save({ session });
        await audit(
          session,
          null,
          "verification_time_changed",
          "GuideProfile",
          p,
          before,
        );
      }
    });
  const missed = await Occurrence.find({
    status: { $in: ["upcoming", "check_in_open"] },
    startsAt: { $lt: new Date(+now - 60 * 60000) },
  })
    .select("_id")
    .lean();
  for (const o of missed)
    await OperationalCase.updateOne(
      { key: `guide-no-start:${o._id}` },
      {
        $setOnInsert: {
          key: `guide-no-start:${o._id}`,
          type: "potential_guide_no_show",
          occurrence: o._id,
          report:
            "Scheduled start passed without a recorded start. Investigation required; no automatic penalty.",
        },
      },
      { upsert: true },
    );
  const overdue = await Occurrence.find({
    status: "in_progress",
    endsAt: {
      $lte: new Date(
        +now - (Number(process.env.AUTO_COMPLETE_GRACE_HOURS) || 2) * 3600000,
      ),
    },
  })
    .select("_id")
    .lean();
  for (const row of overdue)
    await atomic(async (session) => {
      const o = await Occurrence.findOne({
        _id: row._id,
        status: "in_progress",
      }).session(session);
      if (!o) return;
      o.status = "completed";
      o.actualEndedAt = now;
      o.completionSource = "system";
      await o.save({ session });
      const bookings = await Booking.find({
        occurrence: o._id,
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
        if (reviewEligible(b, o, now))
          await enqueue(
            session,
            `review-invite:${b._id}`,
            "review_invitation",
            { booking: String(b._id) },
            new Date(+now + env.reviewInviteDelayMinutes * 60000));
      }
      await audit(session, null, "occurrence_auto_completed", "Occurrence", o, {
        status: "in_progress",
      });
    });
}
