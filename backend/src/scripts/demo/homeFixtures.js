import { isDeepStrictEqual } from "node:util";
import { DEMO_DATABASE, DEMO_NOTICE, demoId } from "./fixtures.js";
import { normalizeTripSchedule } from "../../utils/tripSchedule.js";
import { tripState } from "../../domain/policies.js";

// Additive refresh for our original demo trips only. Never rewrite a booked slot,
// restore visibility, inflate ratings, or update a visitor-created document.
export function demoHomePatch(row, existing) {
  if (row.model !== "Trip" || !existing) return {};
  const fixture = row.document;
  if (String(existing._id) !== String(demoId(row.key)) ||
      String(existing.guide) !== String(fixture.guide) ||
      !existing.description?.includes(DEMO_NOTICE) ||
      ["title", "duration", "price", "groupSize"].some(key => existing[key] !== fixture[key]) ||
      (existing.publishedVersion || 0) > 1 ||
      tripState(existing).lifecycleStatus !== "live" ||
      tripState(existing).reviewStatus !== "approved") return {};

  const patch = {};
  if (fixture.featured && !existing.featured && !existing.featuredFrom && !existing.featuredUntil) {
    patch.featured = true;
  }
  const original = normalizeTripSchedule(existing.schedule, existing.groupSize);
  const slots = [...original.slots];
  for (const slot of fixture.schedule.slots) {
    if (slots.some(current => current.occurrenceKey === slot.occurrenceKey ||
      (current.date === slot.date && current.startTime < slot.endTime && slot.startTime < current.endTime))) continue;
    slots.push(slot);
  }
  if (slots.length !== original.slots.length) {
    patch.schedule = {
      ...existing.schedule,
      ...normalizeTripSchedule({ dates: [...new Set(slots.map(slot => slot.date))], slots }, existing.groupSize),
    };
  }
  return patch;
}

export async function planDemoHomeRefresh(rows, models) {
  const plan = [];
  for (const row of rows.filter(row => row.model === "Trip")) {
    const existing = await models.Trip.findById(row.document._id).lean();
    const patch = demoHomePatch(row, existing);
    if (!Object.keys(patch).length) continue;
    plan.push({ row, existing, patch });
  }
  return plan;
}

export async function applyDemoHomeRefresh(plan, models, connection) {
  if (connection.name !== DEMO_DATABASE) throw new Error("Connected database is not the portfolio demo database.");
  let updated = 0;
  for (const { row, existing, patch } of plan) {
    if (connection.name !== DEMO_DATABASE) throw new Error("Database safety check failed.");
    if (!isDeepStrictEqual(patch, demoHomePatch(row, existing))) throw new Error("Invalid demo home refresh plan.");
    // Compare-and-set: concurrent guide/admin edits or reservation fences cause
    // a safe conflict instead of replacing the newer schedule or moderation.
    const filter = { _id: existing._id, ...row.identity };
    for (const key of ["schedule", "__v", "updatedAt", "bookingFence", "publishedVersion",
      "status", "lifecycleStatus", "reviewStatus", "featured", "featuredFrom", "featuredUntil",
      "description", "title", "duration", "price", "groupSize"]) {
      filter[key] = existing[key] ?? null;
    }
    const result = await models.Trip.updateOne(filter, { $set: patch, $inc: { __v: 1 } },
      { runValidators: true, timestamps: false });
    if (result.matchedCount !== 1) throw new Error("Demo trip changed during refresh; inspect and rerun the dry-run.");
    updated++;
  }
  return { updated };
}
