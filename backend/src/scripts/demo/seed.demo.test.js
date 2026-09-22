import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { DEMO_DATABASE, DEMO_MEDIA, DEMO_TRIP_DESTINATIONS, buildDemoFixtures, demoId, destinations, FEATURED_DEMO_TRIPS } from "./fixtures.js";
import { demoMediaPatch, planDemoMediaRefresh, applyDemoMediaRefresh } from "./mediaFixtures.js";
import { demoHomePatch, planDemoHomeRefresh, applyDemoHomeRefresh } from "./homeFixtures.js";
import { occurrenceDateTime } from "../../utils/tripSchedule.js";
import { accountActive, verificationValid } from "../../domain/policies.js";
import { validateDemoTarget, readDemoSettings, loadDemoModels, inspectSeedRows, upsertSeedRows } from "../seed.demo.js";

const uri = `mongodb+srv://fixture.mongodb.net/${DEMO_DATABASE}?retryWrites=true&w=majority`;
const values = {
  MONGODB_URI: uri, DEMO_ATLAS_HOST: "fixture.mongodb.net", DEMO_ADMIN_EMAIL: "owner@example.invalid",
  DEMO_ADMIN_PASSWORD: randomUUID(), DEMO_TOURIST_PASSWORD: randomUUID(), DEMO_GUIDE_PASSWORD: randomUUID(),
};
const now = new Date("2026-09-17T22:30:00Z");
const passwordHashes = {
  admin: await bcrypt.hash(values.DEMO_ADMIN_PASSWORD, 4),
  tourist: await bcrypt.hash(values.DEMO_TOURIST_PASSWORD, 4),
  guide: await bcrypt.hash(values.DEMO_GUIDE_PASSWORD, 4),
};
const fixtures = () => buildDemoFixtures({ ...readDemoSettings(values), passwordHashes, now });

// Fresh processes isolate module configuration from developer .env files and secrets.
function runConfigCheck(body, extraEnv = {}) {
  const envUrl = new URL("../../config/env.js", import.meta.url).href;
  const cloudUrl = new URL("../../config/cloudinary.js", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e",
    `import assert from 'node:assert/strict'; const envUrl = ${JSON.stringify(envUrl)}; const cloudUrl = ${JSON.stringify(cloudUrl)}; ${body}`,
  ], {
    cwd: tmpdir(), encoding: "utf8", timeout: 30000,
    env: {
      SystemRoot: process.env.SystemRoot || "", TEMP: tmpdir(), TMP: tmpdir(),
      NODE_ENV: "production", JWT_SECRET: randomUUID(), MONGODB_URI: uri,
      FRONTEND_URL: "https://frontend.example.invalid", BACKEND_PUBLIC_URL: "https://backend.example.invalid",
      CLOUDINARY_URL: "", CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "",
      ...extraEnv,
    },
  });
  assert.equal(result.error, undefined, "Configuration check process must complete");
  assert.equal(result.status, 0, "Isolated configuration assertions must pass (output withheld)");
}

test("production requires explicit DB, JWT and HTTPS origins", () => {
  runConfigCheck(`const {env} = await import(envUrl); assert.equal(env.mongoUri, ${JSON.stringify(uri)});`);
  for (const key of ["JWT_SECRET", "MONGODB_URI", "FRONTEND_URL", "BACKEND_PUBLIC_URL"]) {
    runConfigCheck("await assert.rejects(import(envUrl));", { [key]: "" });
  }
  runConfigCheck("await assert.rejects(import(envUrl));", { FRONTEND_URL: "http://frontend.example.invalid" });
});

test("Cloudinary explicit fields and legacy URL work; partial fields fail", () => {
  const apiKey = randomUUID();
  const apiSecret = randomUUID();
  runConfigCheck("const {cloudinary,isCloudinaryConfigured} = await import(cloudUrl); assert.ok(isCloudinaryConfigured()); assert.equal(cloudinary.config().cloud_name, 'demo-cloud'); assert.equal(cloudinary.config().api_secret, process.env.CLOUDINARY_API_SECRET);", {
    CLOUDINARY_CLOUD_NAME: "demo-cloud", CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret,
  });
  runConfigCheck("const {cloudinary,isCloudinaryConfigured} = await import(cloudUrl); assert.ok(isCloudinaryConfigured()); assert.equal(cloudinary.config().cloud_name, 'legacy-demo');", {
    CLOUDINARY_URL: `cloudinary://${apiKey}:${apiSecret}@legacy-demo`,
  });
  runConfigCheck("await assert.rejects(import(cloudUrl));", { CLOUDINARY_CLOUD_NAME: "demo-cloud" });
});

test("requires exact Atlas host/database before any connection", () => {
  assert.deepEqual(validateDemoTarget(uri, values.DEMO_ATLAS_HOST), { database: DEMO_DATABASE, host: "fixture.mongodb.net" });
  for (const bad of [undefined, "", "mongodb://127.0.0.1/nefru", uri.replace(DEMO_DATABASE, "nefru"),
    uri.replace(DEMO_DATABASE, `${DEMO_DATABASE}_test`), uri.replace(DEMO_DATABASE, ""),
    uri.replace(DEMO_DATABASE, `${DEMO_DATABASE}%2Fother`), `${uri}&dbName=nefru`, `${uri}&tls=false`,
    uri.replace("fixture.mongodb.net", "fixture.mongodb.net.evil.invalid"), `${uri}#other`]) {
    assert.throws(() => validateDemoTarget(bad, values.DEMO_ATLAS_HOST));
  }
  assert.throws(() => validateDemoTarget(uri, "other.mongodb.net"));
  assert.throws(() => validateDemoTarget(uri, ""));
  assert.equal(mongoose.connection.readyState, 0);
});

test("seed credentials must be supplied; admin is separate; legacy media base is ignored", () => {
  for (const key of ["DEMO_ADMIN_EMAIL", "DEMO_ADMIN_PASSWORD", "DEMO_TOURIST_PASSWORD", "DEMO_GUIDE_PASSWORD"]) {
    assert.throws(() => readDemoSettings({ ...values, [key]: "" }));
  }
  assert.throws(() => readDemoSettings({ ...values, DEMO_ADMIN_PASSWORD: values.DEMO_GUIDE_PASSWORD }));
  assert.throws(() => readDemoSettings({ ...values, DEMO_ADMIN_EMAIL: "tourist1@demo.example.com" }));
  assert.deepEqual(readDemoSettings({ ...values, DEMO_MEDIA_BASE_URL: "https://unused.example.invalid" }), readDemoSettings(values));
  assert.throws(() => readDemoSettings({ ...values, DEMO_GUIDE_PASSWORD: "أ".repeat(40) }));
});

test("demo media uses the six exact versioned URLs, including Giza PNG", () => {
  assert.deepEqual(DEMO_MEDIA, {
    cairo: "https://res.cloudinary.com/w30patrt/image/upload/v1790034624/cairo.jpg",
    giza: "https://res.cloudinary.com/w30patrt/image/upload/v1790034117/giza.png",
    luxor: "https://res.cloudinary.com/w30patrt/image/upload/v1790034627/luxor.jpg",
    aswan: "https://res.cloudinary.com/w30patrt/image/upload/v1790034624/aswan.jpg",
    alexandria: "https://res.cloudinary.com/w30patrt/image/upload/v1790034620/alexandria.jpg",
    siwa: "https://res.cloudinary.com/w30patrt/image/upload/v1790034629/siwa.jpg",
  });
  const seen = new Set();
  for (const row of fixtures().filter(row => row.model === "Trip")) {
    const city = DEMO_TRIP_DESTINATIONS[row.key];
    seen.add(city);
    assert.equal(row.document.image, DEMO_MEDIA[city]);
    assert.deepEqual(row.document.gallery, [DEMO_MEDIA[city]]);
    assert.equal(String(row.document._id), String(demoId(row.key)));
    assert.equal(String(row.document.guide), String(demoId(`guide:${city}`)));
  }
  assert.equal(seen.size, 6);
});

test("media refresh plans only deterministic demo image/gallery changes and fails safely on conflicts", async () => {
  const row = fixtures().find(row => row.key === "trip:pyramids");
  const old = { ...row.document, image: "https://example.invalid/old.jpg", gallery: [],
    lifecycleStatus: "hidden_by_admin", publishedVersion: 3 };
  const patch = demoMediaPatch(row, old);
  assert.deepEqual(patch, { image: DEMO_MEDIA.giza, gallery: [DEMO_MEDIA.giza] });
  assert.deepEqual(demoMediaPatch(row, { ...old, ...patch }), {});
  for (const changes of [{ _id: new mongoose.Types.ObjectId() }, { guide: new mongoose.Types.ObjectId() }, { description: "Visitor trip" }]) {
    assert.deepEqual(demoMediaPatch(row, { ...old, ...changes }), {});
  }
  assert.deepEqual(demoMediaPatch({ ...row, key: "trip:unknown" }, old), {});
  assert.deepEqual(demoMediaPatch({ ...row, model: "Booking" }, old), {});
  let writes = 0;
  const models = { Trip: { findById: () => ({ lean: async () => old }), updateOne: async (filter, update, options) => {
    writes++;
    assert.deepEqual(update, { $set: patch });
    assert.equal(options.upsert, false);
    assert.equal(options.timestamps, false);
    assert.equal(filter.image, old.image);
    assert.deepEqual(filter.gallery, old.gallery);
    return { matchedCount: 0 };
  } } };
  const plan = await planDemoMediaRefresh([row], models);
  assert.equal(plan.length, 1);
  assert.equal(writes, 0);
  await assert.rejects(applyDemoMediaRefresh(plan, models, { name: "nefru" }), /portfolio demo database/);
  await assert.rejects(applyDemoMediaRefresh([{ ...plan[0], patch: { ...patch, schedule: {} } }], models, { name: DEMO_DATABASE }), /Invalid demo media/);
  assert.equal(writes, 0);
  await assert.rejects(applyDemoMediaRefresh(plan, models, { name: DEMO_DATABASE }), /changed during refresh/);
});

test("fixture inventory, deterministic IDs and all current model validations", async () => {
  const rows = fixtures();
  const models = await loadDemoModels();
  assert.equal(mongoose.connection.readyState, 0);
  assert.equal(mongoose.get("autoCreate"), false);
  assert.equal(mongoose.get("autoIndex"), false);
  assert.equal(rows.length, 49);
  const counts = Object.fromEntries(Object.keys(models).map(name => [name, rows.filter(r => r.model === name).length]));
  assert.deepEqual(counts, { User: 10, TouristProfile: 3, GuideProfile: 6, Trip: 10, Booking: 10, Review: 10 });
  assert.equal(new Set(rows.map(row => String(row.document._id))).size, 49);
  assert.equal(String(demoId("admin")), String(demoId("admin")));
  assert.deepEqual(rows.map(r => String(r.document._id)), fixtures().map(r => String(r.document._id)));
  for (const row of rows) await new models[row.model](row.document).validate();
  const admin = rows.find(r => r.key === "admin").document;
  assert.equal(await bcrypt.compare(values.DEMO_ADMIN_PASSWORD, admin.password), true);
  assert.notEqual(admin.password, values.DEMO_ADMIN_PASSWORD);
});

test("future Cairo schedules have valid unique slots and integer capacities", () => {
  const trips = fixtures().filter(r => r.model === "Trip");
  assert.deepEqual(destinations.map(d => d.name), ["Cairo", "Giza", "Luxor", "Aswan", "Alexandria", "Siwa"]);
  for (const { document: trip } of trips) {
    assert.equal(trip.currency, "EGP");
    assert.ok(trip.schedule.slots.length >= 11);
    assert.equal(trip.schedule.dates[0], "2026-09-18"); // September 18 in Cairo at the reference time.
    assert.equal(new Set(trip.schedule.slots.map(s => s.occurrenceKey)).size, trip.schedule.slots.length);
    for (const slot of trip.schedule.slots) {
      assert.ok(slot.date > now.toISOString().slice(0, 10));
      assert.ok(occurrenceDateTime(slot.date, slot.startTime) > now);
      assert.ok(slot.startTime < slot.endTime);
      assert.ok(Number.isInteger(slot.capacity) && slot.capacity > 0);
      assert.equal(slot.capacity, trip.groupSize);
    }
  }
});

test("home fixtures curate six trips without manufacturing trusted-guide review evidence", () => {
  const rows = fixtures();
  const trips = rows.filter(row => row.model === "Trip");
  assert.deepEqual(trips.filter(row => row.document.featured).map(row => row.key), FEATURED_DEMO_TRIPS.map(key => `trip:${key}`));
  for (const { document: trip } of trips) {
    assert.equal(trip.lifecycleStatus, "live");
    assert.equal(trip.reviewStatus, "approved");
    assert.equal(trip.publishedVersion, 1);
  }
  for (const { document: guide } of rows.filter(row => row.model === "GuideProfile")) {
    assert.equal(verificationValid(guide), true);
    assert.equal(accountActive(rows.find(row => String(row.document._id) === String(guide.user)).document), true);
    assert.equal(guide.rating, 0);
    assert.equal(guide.reviewsCount, 0); // No legitimate verified evidence exists in this seed.
  }
});

test("today availability respects Cairo summer/winter clocks and real departure cutoffs", () => {
  for (const instant of ["2026-09-21T12:00:00Z", "2026-12-21T13:00:00Z"]) {
    const at = new Date(instant); // 15:00 Cairo in each season.
    const rows = buildDemoFixtures({ ...readDemoSettings(values), passwordHashes, now: at });
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(at);
    const available = rows.filter(row => row.model === "Trip" && row.document.schedule.slots.some(slot => slot.date === today));
    assert.equal(available.length, 4);
    for (const row of available) for (const slot of row.document.schedule.slots) {
      assert.ok(occurrenceDateTime(slot.date, slot.startTime) > at);
      assert.ok(occurrenceDateTime(slot.date, slot.endTime) > occurrenceDateTime(slot.date, slot.startTime));
    }
  }
  const late = new Date("2026-09-21T20:30:00Z"); // 23:30 Cairo; no invented late-night availability.
  const rows = buildDemoFixtures({ ...readDemoSettings(values), passwordHashes, now: late });
  assert.ok(rows.filter(row => row.model === "Trip").every(row => row.document.schedule.dates[0] === "2026-09-22"));
});

test("home refresh is additive, protects curated state and skips non-fixture/changed/hidden records", async () => {
  const row = fixtures().find(row => row.key === "trip:pyramids");
  const old = { ...row.document, featured: false,
    schedule: { dates: ["2026-09-20"], slots: [row.document.schedule.slots.find(slot => slot.date === "2026-09-20")] } };
  const patch = demoHomePatch(row, old);
  assert.equal(patch.featured, true);
  assert.ok(patch.schedule.slots.some(slot => slot.occurrenceKey === old.schedule.slots[0].occurrenceKey));
  assert.deepEqual(demoHomePatch(row, { ...old, ...patch }), {});
  const changedSlot = { ...old.schedule.slots[0], capacity: 2, endTime: "14:00" };
  const retained = demoHomePatch(row, { ...old, schedule: { dates: [changedSlot.date], slots: [changedSlot] } });
  assert.deepEqual(retained.schedule.slots.find(slot => slot.occurrenceKey === changedSlot.occurrenceKey), changedSlot);
  for (const change of [ { _id: new mongoose.Types.ObjectId() }, { description: "Visitor trip" },
    { title: "Edited by guide" }, { groupSize: 20 }, { publishedVersion: 2 },
    { lifecycleStatus: "hidden_by_admin" }, { reviewStatus: "in_review" } ]) {
    assert.deepEqual(demoHomePatch(row, { ...old, ...change }), {});
  }
  assert.equal(demoHomePatch(row, { ...old, featuredUntil: new Date("2026-01-01") }).featured, undefined);
  let writes = 0;
  const models = { Trip: { findById: () => ({ lean: async () => old }), updateOne: async () => { writes++; return { matchedCount: 0 }; } } };
  const plan = await planDemoHomeRefresh([row], models);
  assert.equal(plan.length, 1);
  assert.equal(writes, 0);
  await assert.rejects(applyDemoHomeRefresh(plan, models, { name: "nefru" }), /portfolio demo database/);
  assert.equal(writes, 0);
  await assert.rejects(applyDemoHomeRefresh(plan, models, { name: DEMO_DATABASE }), /changed during refresh/);
});

test("reviews are explicitly unverified with unpaid, unrelated-to-Paymob booking fixtures", () => {
  const rows = fixtures();
  const byId = new Map(rows.map(r => [String(r.document._id), r]));
  for (const { document: review } of rows.filter(r => r.model === "Review")) {
    assert.equal(review.isVerifiedBooking, false);
    assert.match(review.comment, /Portfolio demo: fictional/);
    const booking = byId.get(String(review.booking)).document;
    assert.equal(String(booking.trip), String(review.trip));
    assert.equal(String(booking.tourist), String(review.tourist));
    assert.equal(String(booking.guide), String(review.guide));
    assert.equal(byId.get(String(booking.trip)).model, "Trip");
    assert.equal(byId.get(String(booking.guide)).document.role, "guide");
    assert.equal(byId.get(String(booking.tourist)).document.role, "tourist");
    assert.equal(booking.bookingSource, "seed");
    assert.equal(booking.paymentProvider, "none");
    assert.equal(booking.paymentStatus, "unpaid");
    assert.equal(booking.guideEarnings, 0);
    assert.equal(booking.numberOfGuests, 1);
    for (const key of ["paymobOrderId", "paymobIntentionId", "paymobTransactionId", "paymobClientSecret"]) assert.equal(booking[key], "");
    assert.ok(booking.endAt < now);
  }
  assert.ok(rows.every(r => !["PaymentMethod", "GuideVerification", "Notification", "BookingSeat"].includes(r.model)));
});

function fakeModels(rows) {
  const records = new Map();
  const models = {};
  for (const { model } of rows) {
    if (models[model]) continue;
    const documents = new Map();
    records.set(model, documents);
    const query = value => ({ select() { return this; }, async lean() { return value; } });
    models[model] = {
      findById: id => query(documents.get(String(id)) || null),
      findOne: filter => query([...documents.values()].find(d => Object.entries(filter).every(([k, v]) => String(d[k]) === String(v))) || null),
      async updateOne(filter, update, options) {
        assert.deepEqual(Object.keys(update), ["$setOnInsert"]);
        assert.equal(options.upsert, true);
        assert.equal(options.timestamps, false);
        const key = String(filter._id);
        if (documents.has(key)) return { upsertedCount: 0 };
        documents.set(key, { ...update.$setOnInsert });
        return { upsertedCount: 1 };
      },
    };
  }
  return { records, models };
}

test("read-only inspection does not write; rerun preserves passwords, schedules and visitor data", async () => {
  const rows = fixtures();
  const { records, models } = fakeModels(rows);
  assert.equal((await inspectSeedRows(rows, models)).filter(r => r.action === "insert").length, 49);
  assert.equal([...records.values()].reduce((n, map) => n + map.size, 0), 0);
  await assert.rejects(upsertSeedRows(rows, models, { name: "nefru" }));
  assert.equal([...records.values()].reduce((n, map) => n + map.size, 0), 0);
  assert.deepEqual(await upsertSeedRows(rows, models, { name: DEMO_DATABASE }), { inserted: 49, preserved: 0 });
  const admin = records.get("User").get(String(demoId("admin")));
  admin.password = "changed-by-owner";
  const trip = records.get("Trip").get(String(demoId("trip:pyramids")));
  trip.schedule = { dates: ["2030-01-01"], slots: [] };
  records.get("User").set("visitor", { _id: "visitor", email: "visitor@example.invalid" });
  assert.equal((await inspectSeedRows(rows, models)).filter(r => r.action === "preserve").length, 49);
  assert.deepEqual(await upsertSeedRows(rows, models, { name: DEMO_DATABASE }), { inserted: 0, preserved: 49 });
  assert.equal(admin.password, "changed-by-owner");
  assert.deepEqual(trip.schedule.dates, ["2030-01-01"]);
  assert.equal(records.get("User").has("visitor"), true);
});

test("identity/unique collisions and unexpected verified demo reviews stop the seed", async () => {
  const rows = fixtures();
  const { records, models } = fakeModels(rows);
  records.get("User").set("collision", { _id: "collision", email: values.DEMO_ADMIN_EMAIL });
  await assert.rejects(inspectSeedRows(rows, models), /Unique fixture collision/);
  records.get("User").clear();
  await upsertSeedRows(rows, models, { name: DEMO_DATABASE });
  const admin = records.get("User").get(String(demoId("admin")));
  admin.role = "guide";
  await assert.rejects(inspectSeedRows(rows, models), /identity collision/);
  admin.role = "admin";
  const review = records.get("Review").get(String(demoId("review:pyramids")));
  review.isVerifiedBooking = true;
  await assert.rejects(inspectSeedRows(rows, models), /marked verified/);
});
