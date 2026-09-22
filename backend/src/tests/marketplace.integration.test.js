import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import mongoose from "mongoose";
import { setTimeout as delay } from "node:timers/promises";

// Opt-in isolated MongoDB replica set. Never reads mongod.cfg or an existing dbPath.
test(
  "isolated replica-set domain workflows, concurrency and history",
  { skip: !process.env.NEFRU_TEST_MONGOD, timeout: 180000 },
  async (t) => {
    const binary = process.env.NEFRU_TEST_MONGOD;
    await access(binary);
    // Prevent dotenv from inheriting developer provider credentials in API tests.
    const example = await readFile(
      new URL("../../.env.demo.example", import.meta.url),
      "utf8",
    );
    for (const line of example.split(/\r?\n/)) {
      const key = line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1];
      if (key) process.env[key] = "";
    }
    Object.assign(process.env, {
      NODE_ENV: "test",
      JWT_SECRET: "isolated-test-only-secret-not-for-deployment",
      DEV_AUTH_BYPASS: "false",
      PAYMOB_INTEGRATION_IDS: "123",
      FRONTEND_URL: "http://localhost:5173",
    });
    const dir = await mkdtemp(path.join(tmpdir(), "nefru-domain-test-"));
    const probe = net.createServer();
    await new Promise((r) => probe.listen(0, "127.0.0.1", r));
    const port = probe.address().port;
    await new Promise((r) => probe.close(r));
    const child = spawn(
      binary,
      [
        "--dbpath",
        dir,
        "--port",
        String(port),
        "--bind_ip",
        "127.0.0.1",
        "--replSet",
        "nefru_isolated_test",
        "--logpath",
        path.join(dir, "mongod.log"),
        "--wiredTigerCacheSizeGB",
        "0.25",
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    let client, server;
    try {
      for (let n = 0; n < 60; n++) {
        try {
          client = new mongoose.mongo.MongoClient(
            `mongodb://127.0.0.1:${port}/?directConnection=true`,
            { serverSelectionTimeoutMS: 300 },
          );
          await client.connect();
          break;
        } catch {
          await client?.close();
          client = null;
          await delay(250);
        }
      }
      assert.ok(client, "isolated test mongod must start");
      await client.db("admin").command({
        replSetInitiate: {
          _id: "nefru_isolated_test",
          members: [{ _id: 0, host: `127.0.0.1:${port}` }],
        },
      });
      for (let n = 0; n < 60; n++) {
        if ((await client.db("admin").command({ hello: 1 })).isWritablePrimary)
          break;
        await delay(250);
      }
      await client.close();
      client = null;
      await mongoose.connect(
        `mongodb://127.0.0.1:${port}/nefru_isolated_test?replicaSet=nefru_isolated_test`,
      );
      const { Trip } = await import("../models/trip.model.js"),
        { User } = await import("../models/user.model.js"),
        { GuideProfile } = await import("../models/guide.model.js"),
        { Booking } = await import("../models/booking.model.js"),
        { BookingSeat } = await import("../models/bookingSeat.model.js"),
        { Occurrence } = await import("../models/occurrence.model.js"),
        { Review } = await import("../models/review.model.js"),
        { AuditLog } = await import("../models/auditLog.model.js");
      const domain = await import("../services/marketplace.service.js");
      const reviews = await import("../services/reviewLifecycle.service.js");
      const { reserve } = await import("../services/reservation.service.js");
      for (const model of Object.values(mongoose.models)) await model.init();
      const guide = new User({
        email: "guide@example.com",
        password: "isolated-test-password",
        role: "guide",
        roleProfile: "GuideProfile",
        status: "active",
        accountStatus: "active",
      });
      await guide.save();
      await GuideProfile.create({
        user: guide._id,
        fullName: "Test Guide",
        verificationStatus: "approved",
        identityStatus: "approved",
      });
      const admin = await User.create({
        email: "admin@example.com",
        password: "isolated-test-password",
        role: "admin",
        status: "active",
      });
      const tourists = [];
      for (let i = 0; i < 2; i++)
        tourists.push(
          await User.create({
            email: `tourist${i}@example.com`,
            password: "isolated-test-password",
            role: "tourist",
            roleProfile: "TouristProfile",
            status: "active",
          }),
        );
      const day = new Date(Date.now() + 3 * 86400000)
        .toISOString()
        .slice(0, 10);
      const trip = await Trip.create({
        guide: guide._id,
        title: "Test experience",
        description: "Test description",
        location: "Giza",
        coordinates: { lat: 30, lng: 31 },
        price: 100,
        currency: "EGP",
        duration: "1 hour",
        category: "History",
        image: "https://example.com/demo.jpg",
        groupSize: 1,
        status: "draft",
        lifecycleStatus: "draft",
        reviewStatus: "not_submitted",
        schedule: {
          dates: [day],
          slots: [
            {
              id: "morning",
              startTime: "09:00",
              endTime: "10:00",
              capacity: 1,
            },
          ],
        },
      });
      await assert.rejects(() => domain.actOnTrip(trip._id, "approve", guide));
      await domain.actOnTrip(trip._id, "submit", guide);
      await domain.actOnTrip(trip._id, "approve", admin);
      let o = await Occurrence.findOne({ trip: trip._id });
      assert.ok(o);
      const outcomes = await Promise.allSettled(
        tourists.map((t) =>
          reserve({ tripId: trip._id, occurrenceKey: o.occurrenceKey }, t),
        ),
      );
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(await Booking.countDocuments(), 1);
      assert.equal(await BookingSeat.countDocuments(), 1);
      const b = await Booking.findOne();
      const tourist = tourists.find((t) => String(t._id) === String(b.tourist));
      await User.updateMany({}, { $set: { emailVerified: true } });
      const { default: app } = await import("../app.js");
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const base = `http://127.0.0.1:${server.address().port}/api`;
      assert.equal((await fetch(base + "/health")).status, 200);
      assert.equal((await fetch(base + "/ready")).status, 200);
      const publicResponse = await fetch(base + "/trips");
      assert.equal(publicResponse.status, 200);
      const publicText = await publicResponse.text();
      for (const secretField of [
        "identityStatus",
        "storageKey",
        "tokenVersion",
        "password",
        "privateFeedback",
      ])
        assert.ok(
          !publicText.includes(secretField),
          secretField + " must remain private",
        );
      assert.equal((await fetch(base + "/marketplace/dashboard")).status, 401);
      const login = await fetch(base + "/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: guide.email,
          password: "isolated-test-password",
        }),
      });
      assert.equal(login.status, 200);
      const cookie = login.headers.get("set-cookie")?.split(";")[0];
      assert.ok(cookie, "login session cookie");
      assert.equal(
        (await fetch(base + "/users/profile/me", { headers: { cookie } }))
          .status,
        200,
      );
      assert.equal(
        (
          await fetch(base + `/marketplace/trips/${trip._id}/actions/approve`, {
            method: "POST",
            headers: { cookie, "content-type": "application/json" },
            body: "{}",
          })
        ).status,
        403,
      );
      await domain.actOnTrip(trip._id, "pause", guide);
      assert.equal((await Booking.findById(b._id)).status, "pending_payment");
      await assert.rejects(() =>
        reserve(
          { tripId: trip._id, occurrenceKey: o.occurrenceKey },
          tourists[1],
        ),
      );
      await domain.actOnTrip(trip._id, "resume", guide);
      const revised = await domain.editTrip(trip._id, { price: 200 }, guide);
      assert.equal((await Trip.findById(trip._id)).price, 100);
      await domain.actOnRevision(revised.revisionId, "submit", guide);
      await domain.actOnRevision(revised.revisionId, "approve", admin);
      assert.equal((await Trip.findById(trip._id)).price, 200);
      assert.equal((await Booking.findById(b._id)).totalPrice, 100);
      const cancelRevision = await domain.editTrip(
        trip._id,
        { schedule: { dates: [], slots: [] } },
        guide,
      );
      await domain.actOnRevision(cancelRevision.revisionId, "submit", guide);
      await assert.rejects(() =>
        domain.actOnRevision(cancelRevision.revisionId, "approve", admin),
      );
      assert.equal((await Trip.findById(trip._id)).schedule.dates.length, 1);
      await domain.actOnRevision(
        cancelRevision.revisionId,
        "reject",
        admin,
        "Cannot remove booked occurrence",
      );
      await assert.rejects(() =>
        reviews.submitExperienceReview(tourist, b._id, {
          rating: 5,
          comment: "Cannot review unpaid trip",
        }),
      );
      // Test fixtures simulate verified provider outcome, never issue provider requests.
      const { finalizeSuccessfulPayment } = await import(
        "../controllers/payment.controller.js"
      );
      const transaction = {
        id: "test-transaction-1",
        amount_cents: 10000,
        currency: "EGP",
        integration_id: 123,
        order: { id: "test-order-1" },
      };
      await assert.rejects(() =>
        finalizeSuccessfulPayment({ ...transaction, amount_cents: 1 }, b),
      );
      await finalizeSuccessfulPayment(transaction, b);
      assert.equal((await Booking.findById(b._id)).status, "confirmed");
      const now = new Date();
      await Occurrence.updateOne(
        { _id: o._id },
        {
          $set: {
            startsAt: new Date(+now - 10000),
            endsAt: new Date(+now - 1000),
          },
        },
      );
      await domain.actOnOccurrence(o._id, "start", guide);
      await domain.attendanceAction(b._id, "check_in", guide);
      await domain.actOnOccurrence(o._id, "end", guide);
      await finalizeSuccessfulPayment(transaction, b);
      assert.equal(
        (await Booking.findById(b._id)).status,
        "completed",
        "duplicate callback must not reopen completed booking",
      );
      const review = await reviews.submitExperienceReview(
        tourist,
        b._id,
        {
          rating: 1,
          title: "Authentic negative review",
          comment: "This was an authentic negative experience.",
        },
        { safety: 1, privateFeedback: "Private safety report" },
      );
      assert.equal(review.moderationStatus, "pending_moderation");
      await reviews.moderateReview(review._id, "publish", admin);
      assert.equal((await Trip.findById(trip._id)).rating, 1);
      await reviews.submitExperienceReview(tourist, b._id, {
        rating: 5,
        comment: "Duplicate request",
      });
      assert.equal(await Review.countDocuments(), 1);
      await assert.rejects(() =>
        reviews.moderateReview(review._id, "hide", admin, "negative_rating"),
      );
      await reviews.moderateReview(
        review._id,
        "hide",
        admin,
        "personal_information",
      );
      assert.equal((await Trip.findById(trip._id)).rating, 0);
      const { qualityMetrics } = await import("../services/quality.service.js");
      const safeQuality = await qualityMetrics(guide._id);
      assert.equal(safeQuality.metrics, null);
      assert.equal(safeQuality.internalQualityScore, undefined);
      assert.equal(
        (await qualityMetrics(guide._id, { includePrivate: true }))
          .internalQualityScore,
        20,
      );
      const { GuideVerification } = await import(
        "../models/guideVerification.model.js"
      );
      await GuideVerification.init();
      const gp = await GuideProfile.findOne({ user: guide._id });
      await GuideVerification.create({
        guideProfile: gp._id,
        documents: [
          {
            documentType: "guide_license",
            storageKey: "isolated-test-placeholder",
            originalName: "test-fixture",
            mimeType: "application/pdf",
          },
        ],
      });
      const expiryDate = new Date(Date.now() + 86400000 * 100).toISOString();
      await assert.rejects(() =>
        domain.verificationAction(guide._id, "approve", admin, {
          kind: "license",
          expiryDate,
        }),
      );
      await domain.submitGuideVerification(guide, "license");
      await domain.verificationAction(guide._id, "approve", admin, {
        kind: "license",
        expiryDate,
      });
      assert.equal(
        (await GuideProfile.findOne({ user: guide._id })).licenseStatus,
        "approved",
      );
      await assert.rejects(() =>
        domain.submitGuideVerification(guide, "license"),
      );
      const { DomainJob } = await import("../models/domainJob.model.js");
      const { Notification } = await import("../models/notification.model.js");
      const { runDueJob } = await import("../services/domainWorker.service.js");
      await DomainJob.updateMany({}, { $set: { completedAt: new Date() } });
      await domain.enqueue(null, "isolated-job", "notification", {
        user: String(tourist._id),
        title: "Test event",
        message: "Isolated delivery",
      });
      await Promise.all([runDueJob(), runDueJob()]);
      assert.equal(
        await Notification.countDocuments({ eventKey: "isolated-job" }),
        1,
      );
      const late = await Booking.create({
        ...b.toObject(),
        _id: new mongoose.Types.ObjectId(),
        __v: 0,
        status: "pending_payment",
        holdExpiresAt: new Date(Date.now() - 1000),
        tourist: tourists.find((t) => String(t._id) !== String(tourist._id))
          ._id,
      });
      await finalizeSuccessfulPayment(
        {
          ...transaction,
          id: "test-late-payment",
          order: { id: "test-late-order" },
        },
        late,
      );
      const lateResult = await Booking.findById(late._id);
      assert.equal(lateResult.status, "expired");
      assert.equal(lateResult.paymentStatus, "paid");
      assert.equal(lateResult.refundEntitlement, "admin_review");
      assert.equal(await BookingSeat.countDocuments({ booking: late._id }), 0);
      await domain.accountAction(tourist._id, "request_deletion", tourist);
      assert.equal(await Booking.countDocuments(), 2);
      assert.equal(
        (await User.findById(tourist._id)).accountStatus,
        "deletion_requested",
      );
      // An already-authenticated request must not use its stale active account snapshot.
      await assert.rejects(
        () =>
          reserve(
            { tripId: trip._id, occurrenceKey: o.occurrenceKey },
            tourist,
          ),
        /Active tourist required/,
      );
      assert.equal(await Booking.countDocuments(), 2);
      const before = await AuditLog.countDocuments();
      await assert.rejects(() =>
        domain.atomic(async (session) => {
          await AuditLog.create(
            [
              {
                action: "rollback",
                entityType: "Trip",
                entityId: trip._id,
                performedByRole: "system",
              },
            ],
            { session },
          );
          throw Error("rollback");
        }),
      );
      assert.equal(await AuditLog.countDocuments(), before);
      assert.ok(before > 10);
      console.log(
        "Isolated transaction, reservation, revision, attendance, review, account and audit checks passed.",
      );
      await t.test("/api/home demo refresh preserves evidence, history and visitor records", async (context) => {
        const { checkDemoHome } = await import("../scripts/demo/home.integration.js");
        await checkDemoHome(context, { port, apiBase: base });
      });
    } finally {
      if (server) {
        server.closeAllConnections();
        await new Promise((r) => server.close(r));
      }
      await client?.close();
      await mongoose.disconnect();
      child.kill();
      await new Promise((r) => {
        if (child.exitCode !== null) return r();
        child.once("exit", r);
        setTimeout(r, 5000).unref();
      });
    }
  },
);
