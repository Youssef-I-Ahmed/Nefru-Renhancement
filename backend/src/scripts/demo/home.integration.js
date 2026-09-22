import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { buildDemoFixtures, DEMO_DATABASE, demoId, FEATURED_DEMO_TRIPS } from "./fixtures.js";
import { loadDemoModels, inspectSeedRows, upsertSeedRows } from "../seed.demo.js";
import { planDemoHomeRefresh, applyDemoHomeRefresh } from "./homeFixtures.js";
import { planDemoMediaRefresh, applyDemoMediaRefresh } from "./mediaFixtures.js";
import { occurrenceDateTime, normalizeTripSchedule } from "../../utils/tripSchedule.js";

// Called only by the existing disposable MongoDB integration harness. The CLI's
// Atlas guard is not bypassed: this test invokes pure fixtures/internal writers,
// never main(), with a connection to the test process's separate database.
export async function checkDemoHome(t, { port, apiBase }) {
  await mongoose.disconnect();
  await mongoose.connect(`mongodb://127.0.0.1:${port}/${DEMO_DATABASE}?replicaSet=nefru_isolated_test`);
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-21T05:00:00Z") }); // 08:00 Cairo
  const models = await loadDemoModels();
  const hash = await bcrypt.hash("isolated-demo-test-password", 4);
  const settings = { adminEmail: "demo-admin@example.invalid", passwordHashes: { admin: hash, tourist: hash, guide: hash }, now: new Date() };
  const rows = buildDemoFixtures(settings);
  for (const row of rows) row.document = new models[row.model](row.document).toObject();
  for (const model of Object.values(models)) await model.createIndexes();

  // Reproduce already-seeded v1 data: no curated trips, first departure in two days.
  const legacy = rows.map(row => {
    if (row.model !== "Trip") return row;
    const slots = row.document.schedule.slots.filter(slot => slot.date >= "2026-09-23" && slot.startTime === "09:00");
    return { ...row, document: { ...row.document, featured: false, lifecycleStatus: undefined, reviewStatus: undefined,
      image: "https://example.invalid/old.jpg", gallery: ["https://example.invalid/old.jpg", "https://example.invalid/old-2.jpg"],
      publishedVersion: 0, schedule: normalizeTripSchedule({ dates: [...new Set(slots.map(slot => slot.date))], slots }, row.document.groupSize) } };
  });
  await upsertSeedRows(legacy, models, mongoose.connection);
  const home = async () => {
    const response = await fetch(`${apiBase}/home`);
    assert.equal(response.status, 200);
    return (await response.json()).data;
  };
  let data = await home();
  assert.equal(data.featuredTrips.length, 0);
  assert.equal(data.availableToday.length, 0);
  assert.equal(data.trustedGuides.length, 0);
  assert.equal(data.toursNearYou.length, 6);

  const visitor = await models.Trip.create({ ...rows.find(row => row.key === "trip:pyramids").document,
    _id: new mongoose.Types.ObjectId(), title: "Visitor-created trip", description: "Visitor content", featured: false,
    image: "https://example.invalid/visitor.png", gallery: ["https://example.invalid/visitor.png"],
    schedule: { dates: [], slots: [] } });
  const visitorBefore = await models.Trip.findById(visitor._id).lean();
  const bookingBefore = await models.Booking.find().sort({ _id: 1 }).lean();
  const reviewsBefore = await models.Review.find().sort({ _id: 1 }).lean();
  const usersBefore = await models.User.find().select("+password").sort({ _id: 1 }).lean();
  const tripsBefore = await models.Trip.find().sort({ _id: 1 }).lean();
  const collectionsBefore = await mongoose.connection.db.listCollections().toArray();
  const indexesBefore = await models.Trip.collection.indexes();
  await inspectSeedRows(rows, models);
  const plan = await planDemoHomeRefresh(rows, models);
  const mediaPlan = await planDemoMediaRefresh(rows, models);
  assert.equal(mediaPlan.length, 10);
  assert.equal(plan.length, 10);
  assert.deepEqual(await models.Trip.find().sort({ _id: 1 }).lean(), tripsBefore);
  assert.deepEqual(await mongoose.connection.db.listCollections().toArray(), collectionsBefore);
  assert.deepEqual(await models.Trip.collection.indexes(), indexesBefore);
  await upsertSeedRows(rows, models, mongoose.connection);
  assert.deepEqual(await applyDemoHomeRefresh(plan, models, mongoose.connection), { updated: 10 });
  const beforeMedia = await models.Trip.find().sort({ _id: 1 }).lean();
  assert.deepEqual(await applyDemoMediaRefresh(mediaPlan, models, mongoose.connection), { updated: 10 });
  const afterMedia = await models.Trip.find().sort({ _id: 1 }).lean();
  for (let i = 0; i < beforeMedia.length; i++) {
    const expected = rows.find(row => row.model === "Trip" && String(row.document._id) === String(beforeMedia[i]._id));
    assert.deepEqual(afterMedia[i], expected ? { ...beforeMedia[i], image: expected.document.image, gallery: expected.document.gallery } : beforeMedia[i]);
  }
  assert.deepEqual(await planDemoMediaRefresh(rows, models), []);
  assert.deepEqual(await applyDemoMediaRefresh([], models, mongoose.connection), { updated: 0 });
  assert.deepEqual(await models.Trip.find().sort({ _id: 1 }).lean(), afterMedia);
  assert.deepEqual(await models.User.find().select("+password").sort({ _id: 1 }).lean(), usersBefore);

  data = await home();
  assert.deepEqual(data.featuredTrips.map(trip => trip.id).sort(), FEATURED_DEMO_TRIPS.map(key => String(demoId(`trip:${key}`))).sort());
  assert.equal(data.availableToday.length, 10);
  assert.equal(data.trustedGuides.length, 0, "Unverified demo reviews cannot qualify as Top Rated evidence");
  for (const trip of data.availableToday) {
    assert.equal(trip.lifecycleStatus, "live");
    assert.ok(new Date(trip.startsAt) > new Date());
    assert.equal(trip.spotsLeft, trip.groupSize);
    const fixture = rows.find(row => row.model === "Trip" && String(row.document._id) === trip.id).document;
    assert.equal(trip.image, fixture.image);
    assert.deepEqual(trip.gallery, fixture.gallery);
  }
  assert.ok((await models.Review.find().lean()).every(review => review.isVerifiedBooking === false));
  assert.deepEqual(await models.Booking.find().sort({ _id: 1 }).lean(), bookingBefore);
  assert.deepEqual(await models.Review.find().sort({ _id: 1 }).lean(), reviewsBefore);
  assert.deepEqual(await models.Trip.findById(visitor._id).lean(), visitorBefore);
  assert.deepEqual(await planDemoHomeRefresh(rows, models), []);
  await upsertSeedRows(rows, models, mongoose.connection);
  assert.equal(await models.Trip.countDocuments(), 11);

  // No invented late availability: morning departures age out naturally.
  t.mock.timers.setTime(new Date("2026-09-21T12:00:00Z").getTime()); // 15:00 Cairo
  data = await home();
  assert.equal(data.availableToday.length, 4);
  const { Occurrence } = await import("../../models/occurrence.model.js");
  const felucca = await models.Trip.findById(demoId("trip:felucca")).lean();
  const slot = felucca.schedule.slots.find(slot => slot.date === "2026-09-21" && slot.startTime === "16:00");
  const cancelled = await Occurrence.create({ trip: felucca._id, guide: felucca.guide,
    occurrenceKey: slot.occurrenceKey, startsAt: occurrenceDateTime(slot.date, slot.startTime),
    endsAt: occurrenceDateTime(slot.date, slot.endTime), capacity: slot.capacity, status: "cancelled" });
  const nextRows = buildDemoFixtures({ ...settings, now: new Date("2026-09-22T05:00:00Z") });
  await applyDemoHomeRefresh(await planDemoHomeRefresh(nextRows, models), models, mongoose.connection);
  assert.equal((await Occurrence.findById(cancelled._id)).status, "cancelled");
  assert.equal((await home()).availableToday.length, 3);
  const oldKeys = felucca.schedule.slots.map(slot => slot.occurrenceKey);
  const refreshedKeys = (await models.Trip.findById(felucca._id)).schedule.slots.map(slot => slot.occurrenceKey);
  assert.ok(oldKeys.every(key => refreshedKeys.includes(key)));
  assert.equal(new Set(refreshedKeys).size, refreshedKeys.length);
  assert.deepEqual(await planDemoHomeRefresh(nextRows, models), []);
  t.mock.timers.setTime(new Date("2026-09-21T20:30:00Z").getTime());
  assert.equal((await home()).availableToday.length, 0);
  assert.deepEqual(await models.Trip.findById(visitor._id).lean(), visitorBefore);
}
