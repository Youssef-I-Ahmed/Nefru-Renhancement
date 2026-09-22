import {tripState} from '../domain/policies.js';
import { legacyTripStatus as safeTripStatus } from './marketplace.controller.js';
import mongoose from "mongoose";

import { Trip } from "../models/trip.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizeTripSchedule } from "../utils/tripSchedule.js";

function canManageTrip(user, trip) {
  if (!user || !trip) return false;
  if (user.role === "admin") return true;
  return trip.guide?.toString() === user._id?.toString();
}

function statusText(status) {
  if (["reviewing", "pending"].includes(status)) return "In review";
  if (status === "active") return "Live";
  if (status === "rejected") return "Rejected";
  return "Draft";
}

function summary(trip) {
  return {
    id: trip._id,
    title: trip.title,
    description: trip.description,
    longDescription: trip.longDescription || trip.description,
    location: trip.location,
    coordinates: trip.coordinates,
    price: trip.price,
    currency: trip.currency || "EGP",
    duration: trip.duration,
    image: trip.image,
    category: trip.category,
    status: trip.status || "draft",
    ...tripState(trip),
    statusText:tripState(trip).lifecycleStatus.replaceAll('_',' '),
    groupSize: trip.groupSize || 12,
    actionLabel: ["draft", "rejected"].includes(trip.status) ? "Continue" : "Manage",
    highlights: trip.highlights || [],
    gallery: trip.gallery || [],
    schedule: normalizeTripSchedule(trip.schedule, trip.groupSize || 1),
    moderation: {
      lastAction: trip.moderation?.lastAction || "",
      reason: trip.moderation?.reason || "",
      reviewedAt: trip.moderation?.reviewedAt || null,
    },
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

export const getMyGuideTripsV2 = asyncHandler(async (req, res) => {
  if (!req.user || !["guide", "admin"].includes(req.user.role)) {
    res.status(403);
    throw new Error("Only guides can view their experiences");
  }

  const query = req.user.role === "guide" ? { guide: req.user._id } : {};
  const trips = await Trip.find(query)
    .select("+moderation")
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const counts = {
    all: trips.length,
    active: 0,
    reviewing: 0,
    draft: 0,
    rejected: 0,
  };
  for (const trip of trips) {
    if (trip.status === "active") counts.active += 1;
    else if (["reviewing", "pending"].includes(trip.status)) counts.reviewing += 1;
    else if (trip.status === "rejected") counts.rejected += 1;
    else counts.draft += 1;
  }

  res.status(200).json({
    success: true,
    data: { tours: trips.map(summary), counts },
  });
});

export const changeTripStatusV2 = safeTripStatus;
