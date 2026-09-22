import mongoose from "mongoose";

import { env } from "../config/env.js";
import { Booking } from "../models/booking.model.js";
import { Trip } from "../models/trip.model.js";
import { getFxSnapshot } from "../services/fxRate.service.js";

const APPLY = process.argv.includes("--apply");

function egpFromUsd(usd, egpToUsdRate) {
  const value = Number(usd);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round((value / egpToUsdRate) * 100) / 100;
}

function convertMoneyFields(booking, rate) {
  for (const field of ["pricePerPerson", "totalPrice", "platformFee", "guideEarnings"]) {
    const next = egpFromUsd(booking[field], rate);
    if (next !== null) booking[field] = next;
  }
  booking.currency = "EGP";
}

async function run() {
  await mongoose.connect(env.mongoUri);

  const snapshot = await getFxSnapshot({ forceRefresh: true });
  const usdRate = Number(snapshot.rates?.USD);
  if (!Number.isFinite(usdRate) || usdRate <= 0) {
    throw new Error("A usable EGP→USD rate is required before migrating prices");
  }

  // Missing currency is treated as legacy because the previous schema used USD.
  const legacyCurrency = { $or: [{ currency: "USD" }, { currency: { $exists: false } }, { currency: null }] };
  const trips = await Trip.find(legacyCurrency);
  const bookings = await Booking.find({
    ...legacyCurrency,
    paymentStatus: { $nin: ["paid", "refunded", "partially_refunded"] },
  });
  const historicalPaidUsd = await Booking.countDocuments({
    ...legacyCurrency,
    paymentStatus: { $in: ["paid", "refunded", "partially_refunded"] },
  });

  console.log(
    `FX source: ${snapshot.provider} · EGP→USD ${usdRate} · ${snapshot.updatedAt || snapshot.sourceDate || "latest"}`,
  );
  console.log(`Trips to convert: ${trips.length}`);
  console.log(`Unpaid legacy bookings to convert: ${bookings.length}`);
  console.log(`Historical paid/refunded USD bookings left untouched: ${historicalPaidUsd}`);

  const preview = trips.slice(0, 10).map((trip) => ({
    title: trip.title,
    before: `${trip.price} ${trip.currency || "USD (legacy)"}`,
    after: `${egpFromUsd(trip.price, usdRate)} EGP`,
  }));
  if (preview.length) console.table(preview);

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to write changes.");
    return;
  }

  for (const trip of trips) {
    trip.price = egpFromUsd(trip.price, usdRate);
    trip.currency = "EGP";
    await trip.save();
  }

  for (const booking of bookings) {
    convertMoneyFields(booking, usdRate);
    await booking.save();
  }

  console.log("EGP migration applied successfully.");
}

run()
  .catch((error) => {
    console.error("EGP migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
