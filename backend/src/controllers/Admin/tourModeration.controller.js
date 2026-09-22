import { legacyModeration as safeModeration } from '../marketplace.controller.js';
import mongoose from "mongoose";

import { Booking } from "../../models/booking.model.js";
import { GuideProfile } from "../../models/guide.model.js";
import { Notification } from "../../models/notification.model.js";
import { Trip } from "../../models/trip.model.js";
import { User } from "../../models/user.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendEmail } from "../../utils/sendEmail.js";
import {
  normalizeTripSchedule,
  occurrenceDateTime,
} from "../../utils/tripSchedule.js";

const PAGE_LIMIT = 12;
const FILTER_STATUSES = new Set([
  "all",
  "reviewing",
  "active",
  "draft",
  "rejected",
  "pending",
]);
const ACTIONS = new Set(["publish", "return_changes", "reject", "hide"]);

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pagination(currentPage, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const values = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...values].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
}

function serializeGuide(user, profile) {
  if (!user) return null;
  return {
    id: user._id,
    email: user.email || "",
    accountStatus: user.status || "",
    fullName: profile?.fullName || "",
    avatar: profile?.avatar || "",
    verificationStatus: profile?.verificationStatus || "draft",
    headline: profile?.headline || "",
    location: profile?.location || "",
    yearsExperience: Number(profile?.yearsExperience || 0),
    languages: profile?.languages || [],
    specialties: profile?.specialties || [],
    rating: Number(profile?.rating || 0),
    reviewsCount: Number(profile?.reviewsCount || 0),
  };
}

function serializeRow(trip, profile) {
  return {
    id: trip._id,
    title: trip.title,
    location: trip.location,
    category: trip.category,
    status: trip.status,
    image: trip.image || "",
    price: trip.price,
    currency: trip.currency || "EGP",
    duration: trip.duration,
    rating: Number(trip.rating || 0),
    reviewsCount: Number(trip.reviewsCount || 0),
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    guide: serializeGuide(trip.guide, profile),
    moderation: trip.moderation || {},
  };
}

function readinessFor(trip, guideProfile) {
  const missing = [];
  if (!String(trip.title || "").trim()) missing.push("title");
  if (!String(trip.description || "").trim()) missing.push("description");
  if (!String(trip.location || "").trim()) missing.push("location");
  if (!(Number(trip.price) > 0)) missing.push("price");
  if (!String(trip.duration || "").trim()) missing.push("duration");
  if (!String(trip.category || "").trim()) missing.push("category");
  if (!String(trip.image || "").trim()) missing.push("cover image");

  const schedule = normalizeTripSchedule(trip.schedule, trip.groupSize || 1);
  const futureSlots = schedule.slots.filter((slot) => {
    try {
      return occurrenceDateTime(slot.date, slot.startTime) > new Date();
    } catch {
      return false;
    }
  });
  if (!futureSlots.length) missing.push("future availability");
  if (guideProfile?.verificationStatus !== "approved") missing.push("verified guide");

  return {
    ready: missing.length === 0,
    missing,
    schedule,
    futureSlots: futureSlots.length,
  };
}

async function guideProfilesForTrips(trips) {
  const ids = trips.map((trip) => trip.guide?._id).filter(Boolean);
  if (!ids.length) return new Map();
  const profiles = await GuideProfile.find({ user: { $in: ids } })
    .select(
      "user fullName avatar verificationStatus headline location yearsExperience languages specialties rating reviewsCount",
    )
    .lean();
  return new Map(profiles.map((profile) => [profile.user.toString(), profile]));
}

export const listTourModeration = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const status = String(req.query.status || "all").toLowerCase();
  const q = String(req.query.q || "").trim();

  if (!FILTER_STATUSES.has(status)) {
    res.status(400);
    throw new Error("Invalid tour moderation status filter");
  }

  const filter = {};
  if (status === "reviewing") filter.status = { $in: ["reviewing", "pending"] };
  else if (status !== "all") filter.status = status;
  if (q) {
    const expression = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { title: expression },
      { location: expression },
      { category: expression },
    ];
  }

  const skip = (page - 1) * PAGE_LIMIT;
  const [trips, total, all, reviewing, active, draft, rejected] = await Promise.all([
    Trip.find(filter)
      .select("+moderation")
      .populate("guide", "email status")
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(PAGE_LIMIT)
      .lean(),
    Trip.countDocuments(filter),
    Trip.countDocuments(),
    Trip.countDocuments({ status: { $in: ["reviewing", "pending"] } }),
    Trip.countDocuments({ status: "active" }),
    Trip.countDocuments({ status: "draft" }),
    Trip.countDocuments({ status: "rejected" }),
  ]);

  const profiles = await guideProfilesForTrips(trips);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  res.status(200).json({
    success: true,
    data: {
      tours: trips.map((trip) =>
        serializeRow(
          trip,
          trip.guide ? profiles.get(trip.guide._id.toString()) : null,
        ),
      ),
    },
    meta: {
      page,
      totalPages,
      totalRecords: total,
      pagingView: pagination(page, totalPages),
      counts: { all, reviewing, active, draft, rejected },
    },
  });
});

export const getTourModeration = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid trip ID");
  }

  const trip = await Trip.findById(req.params.id)
    .select("+moderation")
    .populate("guide", "email status createdAt")
    .lean();
  if (!trip) {
    res.status(404);
    throw new Error("Trip not found");
  }

  const guideProfile = trip.guide
    ? await GuideProfile.findOne({ user: trip.guide._id })
        .select(
          "fullName avatar verificationStatus headline location yearsExperience languages specialties rating reviewsCount about",
        )
        .lean()
    : null;

  const [bookingStats] = await Booking.aggregate([
    { $match: { trip: trip._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
        paidRevenue: {
          $sum: {
            $cond: [{ $and: [{ $eq: ["$paymentStatus", "paid"] }, { $eq: ["$currency", "EGP"] }] }, "$totalPrice", 0],
          },
        },
        confirmed: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
      },
    },
  ]);

  const readiness = readinessFor(trip, guideProfile);

  res.status(200).json({
    success: true,
    data: {
      tour: {
        ...trip,
        id: trip._id,
        currency: trip.currency || "EGP",
        schedule: readiness.schedule,
        guide: serializeGuide(trip.guide, guideProfile),
        readiness: {
          ready: readiness.ready,
          missing: readiness.missing,
          futureSlots: readiness.futureSlots,
        },
        bookingStats: {
          total: bookingStats?.total || 0,
          paid: bookingStats?.paid || 0,
          paidRevenue: Number(bookingStats?.paidRevenue || 0),
          confirmed: bookingStats?.confirmed || 0,
          completed: bookingStats?.completed || 0,
        },
      },
    },
  });
});



export const reviewTourModeration = safeModeration;
