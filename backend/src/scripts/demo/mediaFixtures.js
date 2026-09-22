import { isDeepStrictEqual } from "node:util";
import { DEMO_DATABASE, DEMO_MEDIA, DEMO_NOTICE, DEMO_TRIP_DESTINATIONS, demoId } from "./fixtures.js";

export function demoMediaPatch(row, existing) {
  const city = Object.hasOwn(DEMO_TRIP_DESTINATIONS, row.key) ? DEMO_TRIP_DESTINATIONS[row.key] : null;
  if (row.model !== "Trip" || !city || !existing ||
      String(row.document._id) !== String(demoId(row.key)) ||
      String(existing._id) !== String(demoId(row.key)) ||
      String(existing.guide) !== String(demoId(`guide:${city}`)) ||
      !existing.description?.includes(DEMO_NOTICE)) return {};
  const image = DEMO_MEDIA[city];
  if (existing.image === image && isDeepStrictEqual(existing.gallery, [image])) return {};
  return { image, gallery: [image] };
}

export async function planDemoMediaRefresh(rows, models) {
  const plan = [];
  for (const row of rows.filter(row => row.model === "Trip")) {
    const existing = await models.Trip.findById(row.document._id).lean();
    const patch = demoMediaPatch(row, existing);
    if (Object.keys(patch).length) plan.push({ row, existing, patch });
  }
  return plan;
}

export async function applyDemoMediaRefresh(plan, models, connection) {
  if (connection.name !== DEMO_DATABASE) throw new Error("Connected database is not the portfolio demo database.");
  let updated = 0;
  for (const { row, existing, patch } of plan) {
    if (connection.name !== DEMO_DATABASE) throw new Error("Database safety check failed.");
    if (!Object.keys(patch).length || !isDeepStrictEqual(patch, demoMediaPatch(row, existing))) {
      throw new Error("Invalid demo media refresh plan.");
    }
    // Compare the original media so concurrent image edits are never overwritten.
    // No upsert, timestamps, version changes, uploads or asset deletion here.
    const result = await models.Trip.updateOne({
      _id: existing._id, guide: existing.guide, description: existing.description,
      image: Object.hasOwn(existing, "image") ? existing.image : { $exists: false },
      gallery: Object.hasOwn(existing, "gallery") ? existing.gallery : { $exists: false },
    }, { $set: patch }, { upsert: false, runValidators: true, timestamps: false });
    if (result.matchedCount !== 1) throw new Error("Demo media changed during refresh; inspect and rerun the dry-run.");
    updated++;
  }
  return { updated };
}
