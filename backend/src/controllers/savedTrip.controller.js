import mongoose from "mongoose";

import { TouristProfile } from "../models/tourist.model.js";
import { publicTrips } from "../services/catalog.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

async function getProfile(user) {
  return TouristProfile.findOneAndUpdate(
    { user: user._id },
    {
      $setOnInsert: {
        user: user._id,
        fullName: String(user.email || "Nefru traveler").split("@")[0],
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function serializeSavedTrips(ids) {
  return publicTrips({ _id: { $in: ids } });
}

export const getSavedTrips = asyncHandler(async (req, res) => {
  const profile = await getProfile(req.user);
  const trips = await serializeSavedTrips(profile.savedTrips || []);
  res
    .status(200)
    .json({
      success: true,
      data: { trips, ids: trips.map((trip) => trip.id) },
    });
});

export const saveTrip = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.tripId)) {
    res.status(400);
    throw new Error("Invalid trip ID");
  }
  const [trip] = await publicTrips({ _id: req.params.tripId });
  if (!trip) {
    res.status(404);
    throw new Error("Active trip not found");
  }
  const profile = await getProfile(req.user);
  await TouristProfile.updateOne(
    { _id: profile._id },
    { $addToSet: { savedTrips: trip._id } },
  );
  res
    .status(200)
    .json({
      success: true,
      message: "Trip saved",
      data: { tripId: trip._id, saved: true },
    });
});

export const unsaveTrip = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.tripId)) {
    res.status(400);
    throw new Error("Invalid trip ID");
  }
  const profile = await getProfile(req.user);
  await TouristProfile.updateOne(
    { _id: profile._id },
    { $pull: { savedTrips: req.params.tripId } },
  );
  res
    .status(200)
    .json({
      success: true,
      message: "Trip removed from saved trips",
      data: { tripId: req.params.tripId, saved: false },
    });
});
