import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { DEMO_DATABASE, buildDemoFixtures } from "./demo/fixtures.js";
import { planDemoHomeRefresh, applyDemoHomeRefresh } from "./demo/homeFixtures.js";
import { planDemoMediaRefresh, applyDemoMediaRefresh } from "./demo/mediaFixtures.js";

export function validateDemoTarget(uri, expectedHost) {
  let target;
  try { target = new URL(uri); } catch { throw new Error("An explicit Atlas MONGODB_URI is required."); }
  if (target.protocol !== "mongodb+srv:" || !target.hostname.endsWith(".mongodb.net") || target.port) {
    throw new Error("Demo seed accepts an Atlas mongodb+srv URI only.");
  }
  if (!expectedHost || target.hostname !== expectedHost.toLowerCase()) {
    throw new Error("DEMO_ATLAS_HOST must exactly match the approved Atlas host.");
  }
  if (target.pathname !== `/${DEMO_DATABASE}` || target.hash) {
    throw new Error(`Demo seed database must be exactly ${DEMO_DATABASE}.`);
  }
  // Do not permit URI options that redirect/override the selected database or disable TLS.
  const allowed = new Set(["retryWrites", "w", "appName", "authSource"]);
  for (const key of target.searchParams.keys()) {
    if (!allowed.has(key)) throw new Error("Unsupported connection option in demo seed URI.");
  }
  return { database: DEMO_DATABASE, host: target.hostname };
}

export function readDemoSettings(values) {
  validateDemoTarget(values.MONGODB_URI, values.DEMO_ATLAS_HOST);
  const adminEmail = String(values.DEMO_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) || adminEmail.endsWith("@demo.example.com")) {
    throw new Error("Set a distinct DEMO_ADMIN_EMAIL; reserved demo addresses cannot be used for Admin.");
  }
  for (const key of ["DEMO_ADMIN_PASSWORD", "DEMO_TOURIST_PASSWORD", "DEMO_GUIDE_PASSWORD"]) {
    const value = values[key] || "";
    if (value.length < 12 || Buffer.byteLength(value, "utf8") > 72 || /change.?me|your[_ -]|placeholder/i.test(value)) {
      throw new Error(`${key} must be a supplied password of 12+ characters and at most 72 UTF-8 bytes.`);
    }
  }
  if (values.DEMO_ADMIN_PASSWORD === values.DEMO_GUIDE_PASSWORD || values.DEMO_ADMIN_PASSWORD === values.DEMO_TOURIST_PASSWORD) {
    throw new Error("Admin password must differ from demo account passwords.");
  }
  // Media is an explicit approved map in fixtures.js. Legacy DEMO_MEDIA_BASE_URL is ignored.
  return { adminEmail };
}

export async function loadDemoModels() {
  // Importing this runner never connects. No automatic collection/index writes, even during dry-run.
  mongoose.set("autoCreate", false);
  mongoose.set("autoIndex", false);
  const modules = await Promise.all([
    import("../models/user.model.js"), import("../models/tourist.model.js"),
    import("../models/guide.model.js"), import("../models/trip.model.js"),
    import("../models/booking.model.js"), import("../models/review.model.js"),
  ]);
  return Object.assign({}, ...modules.map(module => Object.fromEntries(
    Object.entries(module).filter(([, value]) => value?.modelName),
  )));
}

function sameValue(a, b) {
  return String(a ?? "") === String(b ?? "");
}

export async function inspectSeedRows(rows, models) {
  const plan = [];
  for (const row of rows) {
    const model = models[row.model];
    const existing = await model.findById(row.document._id).lean();
    if (existing && Object.entries(row.identity).some(([key, value]) => !sameValue(existing[key], value))) {
      throw new Error(`Fixture identity collision: ${row.model}/${row.key}. No existing document will be replaced.`);
    }
    const unique = row.model === "User" ? { email: row.document.email }
      : ["GuideProfile", "TouristProfile"].includes(row.model) ? { user: row.document.user }
        : row.model === "Review" ? { booking: row.document.booking } : null;
    if (unique) {
      const collision = await model.findOne(unique).select("_id").lean();
      if (collision && !sameValue(collision._id, row.document._id)) {
        throw new Error(`Unique fixture collision: ${row.model}/${row.key}.`);
      }
    }
    if (existing && row.model === "Review" && existing.isVerifiedBooking !== false) {
      throw new Error("An existing demo review is marked verified; review it manually before rerunning.");
    }
    plan.push({ model: row.model, key: row.key, action: existing ? "preserve" : "insert" });
  }
  return plan;
}

export async function upsertSeedRows(rows, models, connection) {
  if (connection.name !== DEMO_DATABASE) throw new Error("Connected database is not the portfolio demo database.");
  const results = { inserted: 0, preserved: 0 };
  for (const row of rows) {
    if (connection.name !== DEMO_DATABASE) throw new Error("Database safety check failed.");
    const result = await models[row.model].updateOne(
      { _id: row.document._id, ...row.identity },
      { $setOnInsert: row.document },
      { upsert: true, runValidators: true, setDefaultsOnInsert: false, timestamps: false },
    );
    if (result.upsertedCount) results.inserted += 1;
    else results.preserved += 1;
  }
  return results;
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes("--help")) {
    console.log("Usage: npm run seed:demo -- [--dry-run | --apply]\nDefault: read-only dry-run. Requires Atlas target and DEMO_* variables; see docs/portfolio-deployment.md.");
    return;
  }
  if (args.some(arg => !["--dry-run", "--apply"].includes(arg)) || (args.includes("--dry-run") && args.includes("--apply"))) {
    throw new Error("Use either --dry-run or --apply.");
  }
  dotenv.config();
  const settings = readDemoSettings(process.env);
  const apply = args.includes("--apply");
  const passwordHashes = {
    admin: await bcrypt.hash(process.env.DEMO_ADMIN_PASSWORD, 10),
    tourist: await bcrypt.hash(process.env.DEMO_TOURIST_PASSWORD, 10),
    guide: await bcrypt.hash(process.env.DEMO_GUIDE_PASSWORD, 10),
  };
  const models = await loadDemoModels();
  const rows = buildDemoFixtures({ ...settings, passwordHashes });
  // Validate complete documents before any connection or write; updateOne does not run pre-save hashing.
  for (const row of rows) {
    const document = new models[row.model](row.document);
    await document.validate();
    row.document = document.toObject();
    row.document.createdAt ??= new Date();
    row.document.updatedAt ??= row.document.createdAt;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS:10000 });
    if (mongoose.connection.name !== DEMO_DATABASE) throw new Error("Connected database safety check failed.");
    const plan = await inspectSeedRows(rows, models);
    const homeRefresh = await planDemoHomeRefresh(rows, models);
    const mediaRefresh = await planDemoMediaRefresh(rows, models);
    console.log(JSON.stringify({ database: DEMO_DATABASE, mode: apply ? "apply" : "dry-run", plan,
      homeRefresh: homeRefresh.map(({ row, patch }) => ({ key: row.key, fields: Object.keys(patch) })),
      mediaRefresh: mediaRefresh.map(({ row, patch }) => ({ key: row.key, fields: Object.keys(patch) })),
      trustedGuides: "Demo reviews remain unverified. No verified rating counts are fabricated; trustedGuides may be empty.",
    }, null, 2));
    if (!apply) return;
    // Only add schema indexes after target validation and collision checks. Never sync/drop indexes.
    for (const model of Object.values(models)) await model.createIndexes();
    const result = await upsertSeedRows(rows, models, mongoose.connection);
    const refreshed = await applyDemoHomeRefresh(homeRefresh, models, mongoose.connection);
    const mediaRefreshed = await applyDemoMediaRefresh(mediaRefresh, models, mongoose.connection);
    console.log(JSON.stringify({ database: DEMO_DATABASE, ...result, homeTripsUpdated: refreshed.updated,
      mediaTripsUpdated: mediaRefreshed.updated,
      notice: "Demo fixtures only. Curated placement and missing future slots refreshed. Existing slots, bookings, passwords and visitor records preserved. Today is empty after the last valid departure." }));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Driver errors can include URIs, credentials or documents. Never echo them.
    const safe = error?.name === "Error" && !/mongodb|password[:=]|cloudinary:\/\//i.test(error.message);
    console.error(safe ? error.message : "Demo seed aborted. Check the target, fixture configuration and Atlas connectivity; no secrets are logged.");
    process.exitCode = 1;
  });
}
