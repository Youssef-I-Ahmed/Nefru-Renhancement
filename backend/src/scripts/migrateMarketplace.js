import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { validateDemoTarget } from "./seed.demo.js";
import { tripState } from "../domain/policies.js";
import {
  normalizeTripSchedule,
  occurrenceDateTime,
} from "../utils/tripSchedule.js";

export function legacyReviewMapping(review) {
  return {
    moderationStatus: review.isVisible === true ? "published" : "hidden",
    provenance: "legacy",
    isVerifiedBooking: false,
  };
}
export function legacyAccountMapping(user) {
  return {
    accountStatus:
      user.status === "active"
        ? "active"
        : user.status === "pending"
          ? "deactivated_by_user"
          : "suspended_by_admin",
    statusSource: "system",
    statusReason: "Legacy inactive reason unknown; review before restoration",
  };
}
export async function migrateMarketplace(args = process.argv.slice(2)) {
  if (args.includes("--help")) {
    console.log(
      "Atlas demo only. --dry-run (default) or --apply. Backup first. Requires MONGODB_URI and DEMO_ATLAS_HOST.",
    );
    return;
  }
  if (
    args.some((a) => !["--dry-run", "--apply"].includes(a)) ||
    (args.includes("--dry-run") && args.includes("--apply"))
  )
    throw Error("Choose --dry-run or --apply");
  validateDemoTarget(process.env.MONGODB_URI, process.env.DEMO_ATLAS_HOST);
  mongoose.set("autoCreate", false);
  mongoose.set("autoIndex", false);
  const { Occurrence } = await import("../models/occurrence.model.js");
  const { AuditLog } = await import("../models/auditLog.model.js");
  const modules = await Promise.all(
    [
      "tripRevision",
      "privateExperienceSurvey",
      "operationalCase",
      "domainJob",
      "paymentAttempt",
    ].map((n) => import(`../models/${n}.model.js`)),
  );
  await mongoose.connect(process.env.MONGODB_URI, {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 10000,
  });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== "nefru_portfolio_demo")
      throw Error("Database guard failed");
    const apply = args.includes("--apply");
    const report = {
      database: db.databaseName,
      mode: apply ? "apply" : "dry-run",
      trips: 0,
      users: 0,
      bookings: 0,
      reviews: 0,
      guides: 0,
      manual: [],
    };
    if (apply)
      for (const model of [
        Occurrence,
        AuditLog,
        ...modules.flatMap((m) => Object.values(m).filter((v) => v.modelName)),
      ])
        await model.createIndexes();
    async function update(collection, doc, values) {
      if (apply)
        await db
          .collection(collection)
          .updateOne({ _id: doc._id }, { $set: values });
    }
    for await (const trip of db
      .collection("trips")
      .find({ lifecycleStatus: { $exists: false } })) {
      const state = tripState(trip);
      if (trip.status === "approved")
        report.manual.push({
          type: "ambiguous_trip_approved",
          id: String(trip._id),
        });
      await update("trips", trip, {
        ...state,
        status:
          state.lifecycleStatus === "live"
            ? "active"
            : state.reviewStatus === "in_review"
              ? "reviewing"
              : state.reviewStatus === "rejected"
                ? "rejected"
                : "draft",
        publishedVersion: state.reviewStatus === "approved" ? 1 : 0,
      });
      report.trips++;
    }
    for await (const user of db
      .collection("users")
      .find({ accountStatus: { $exists: false } })) {
      await update("users", user, legacyAccountMapping(user));
      report.users++;
    }
    for await (const g of db
      .collection("guideprofiles")
      .find({ identityStatus: { $exists: false } })) {
      await update("guideprofiles", g, {
        identityStatus: ["approved", "rejected"].includes(g.verificationStatus)
          ? g.verificationStatus
          : "pending",
        licenseStatus: "pending",
      });
      report.guides++;
    }
    for await (const r of db
      .collection("reviews")
      .find({ moderationStatus: { $exists: false } })) {
      await update("reviews", r, legacyReviewMapping(r));
      report.reviews++;
    }
    for await (const t of db.collection("trips").find({})) {
      for (const slot of normalizeTripSchedule(t.schedule, t.groupSize).slots) {
        if (apply)
          await Occurrence.updateOne(
            { trip: t._id, occurrenceKey: slot.occurrenceKey },
            {
              $setOnInsert: {
                trip: t._id,
                guide: t.guide,
                occurrenceKey: slot.occurrenceKey,
                startsAt: occurrenceDateTime(slot.date, slot.startTime),
                endsAt: occurrenceDateTime(slot.date, slot.endTime),
                capacity: slot.capacity,
                publishedVersion: t.publishedVersion || 1,
                status: "upcoming",
              },
            },
            { upsert: true },
          );
      }
    }
    for await (const b of db
      .collection("bookings")
      .find({ occurrence: { $exists: false } })) {
      if (b.numberOfGuests !== 1 || !b.occurrenceKey || !b.date || !b.endAt) {
        report.manual.push({
          type: "booking_requires_manual_mapping",
          id: String(b._id),
        });
        continue;
      }
      const id = new mongoose.Types.ObjectId(
        createHash("sha256")
          .update(`occurrence:${b.trip}:${b.occurrenceKey}`)
          .digest("hex")
          .slice(0, 24),
      );
      let occurrence = apply
        ? await Occurrence.findOne({
            trip: b.trip,
            occurrenceKey: b.occurrenceKey,
          })
        : null;
      if (apply && !occurrence) {
        [occurrence] = await Occurrence.create([
          {
            _id: id,
            trip: b.trip,
            guide: b.guide,
            occurrenceKey: b.occurrenceKey,
            startsAt: b.date,
            endsAt: b.endAt,
            capacity: Math.max(
              1,
              await db
                .collection("bookings")
                .countDocuments({
                  trip: b.trip,
                  occurrenceKey: b.occurrenceKey,
                  status: { $in: ["confirmed", "pending_payment"] },
                }),
            ),
            status: b.status === "cancelled" ? "cancelled" : "upcoming",
          },
        ]);
      }
      await update("bookings", b, {
        occurrence: occurrence?._id || id,
        tripSnapshot: b.tripSnapshot || {
          price: b.pricePerPerson,
          currency: b.currency,
          guide: b.guide,
          source: "legacy_partial",
        },
        policySnapshot: b.policySnapshot || { version: "legacy_unknown" },
        attendance: b.attendance || { status: "booked" },
      });
      report.bookings++;
    }
    if (apply) {
      const indexes = await db
        .collection("bookingseats")
        .listIndexes()
        .toArray()
        .catch((e) => {
          if (e.code === 26) return [];
          throw e;
        });
      for (const idx of indexes)
        if (
          idx.key?.expiresAt === 1 &&
          Object.keys(idx.key).length === 1 &&
          idx.expireAfterSeconds === 0
        )
          await db.collection("bookingseats").dropIndex(idx.name);
      await db
        .collection("bookingseats")
        .updateMany(
          { expiresAt: { $ne: null } },
          { $set: { expiresAt: null } },
        );
      const { recomputeRatings } = await import(
        "../services/reviewLifecycle.service.js"
      );
      for await (const t of db.collection("trips").find({}))
        await recomputeRatings(t._id, t.guide);
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  migrateMarketplace().catch(() => {
    console.error(
      "Migration stopped. Inspect connectivity/data safely; no credentials logged.",
    );
    process.exitCode = 1;
  });
