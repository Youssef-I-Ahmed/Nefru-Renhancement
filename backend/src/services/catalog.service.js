import { Trip } from "../models/trip.model.js";
import { GuideProfile } from "../models/guide.model.js";
import { BookingSeat } from "../models/bookingSeat.model.js";
import { Occurrence } from "../models/occurrence.model.js";
import {
  accountActive,
  verificationValid,
  tripState,
  publicGuide,
} from "../domain/policies.js";
import {
  normalizeTripSchedule,
  occurrenceDateTime,
} from "../utils/tripSchedule.js";
export async function publicTrips(filter = {}) {
  const trips = await Trip.find({ ...filter, status: "active" })
    .populate("guide", "status accountStatus")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  const profiles = await GuideProfile.find({
    user: { $in: trips.map((t) => t.guide?._id).filter(Boolean) },
  }).lean();
  return trips
    .filter(
      (t) =>
        tripState(t).lifecycleStatus === "live" &&
        accountActive(t.guide) &&
        verificationValid(
          profiles.find((p) => String(p.user) === String(t.guide._id)),
          { licenseRequired: t.licenseRequired },
        ),
    )
    .map((t) => {
      const p = profiles.find((p) => String(p.user) === String(t.guide._id));
      const keys = [
        "title",
        "description",
        "longDescription",
        "location",
        "coordinates",
        "price",
        "currency",
        "duration",
        "image",
        "category",
        "groupSize",
        "gallery",
        "rating",
        "reviewsCount",
        "highlights",
        "reviews",
        "identityVerificationRequired",
        "featured",
        "featuredFrom",
        "featuredUntil",
      ];
      return {
        ...Object.fromEntries(keys.map((k) => [k, t[k]])),
        reviews: (t.reviews || []).map((r) => ({
          name: r.name?.includes("@")
            ? "Traveler"
            : r.name?.split(" ")[0] || "Traveler",
          date: r.date,
          text: r.text,
          rating: r.rating,
        })),
        id: t._id,
        _id: t._id,
        status: "active",
        lifecycleStatus: "live",
        schedule: normalizeTripSchedule(t.schedule, t.groupSize),
        guide: {
          id: t.guide._id,
          name: p.fullName,
          fullName: p.fullName,
          avatar: p.avatar,
          headline: p.headline,
          about: p.about,
          rating: p.rating,
          reviewsCount: p.reviewsCount,
          verified: true,
        },
      };
    });
}
export async function homeCatalog() {
  const trips = await publicTrips();
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
  }).format(now);
  const seats = await BookingSeat.aggregate([
    { $match: { trip: { $in: trips.map((t) => t._id) } } },
    {
      $group: {
        _id: { trip: "$trip", key: "$occurrenceKey" },
        count: { $sum: 1 },
      },
    },
  ]);
  const closed = await Occurrence.find({
    trip: { $in: trips.map((t) => t._id) },
    status: { $nin: ["upcoming", "check_in_open"] },
  })
    .select("trip occurrenceKey")
    .lean();
  const availableToday = trips
    .flatMap((t) => {
      const slots = t.schedule.slots
        .filter(
          (s) =>
            s.date === today &&
            occurrenceDateTime(s.date, s.startTime) > now &&
            !closed.some(
              (o) =>
                String(o.trip) === String(t._id) &&
                o.occurrenceKey === s.occurrenceKey,
            ),
        )
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (const s of slots) {
        const occupied =
          seats.find(
            (row) =>
              String(row._id.trip) === String(t._id) &&
              row._id.key === s.occurrenceKey,
          )?.count || 0;
        if (occupied < s.capacity)
          return [
            {
              ...t,
              timeSlot: `${s.startTime} - ${s.endTime}`,
              startsAt: occurrenceDateTime(s.date, s.startTime),
              startTime: s.startTime,
              spotsLeft: s.capacity - occupied,
            },
          ];
      }
      return [];
    })
    .sort((a, b) => a.startsAt - b.startsAt);
  const featuredTrips = trips
    .filter(
      (t) =>
        t.featured &&
        (!t.featuredFrom || new Date(t.featuredFrom) <= now) &&
        (!t.featuredUntil || new Date(t.featuredUntil) > now),
    )
    .slice(0, 6);
  const profiles = await GuideProfile.find({ reviewsCount: { $gt: 0 } })
    .populate("user", "status accountStatus")
    .sort({ rating: -1, reviewsCount: -1 })
    .limit(30)
    .lean();
  const trustedGuides = profiles
    .filter((p) => accountActive(p.user) && verificationValid(p))
    .slice(0, 6)
    .map((p) => ({
      ...publicGuide(p),
      user: { _id: p.user._id },
      verified: true,
    }));
  return {
    featuredTrips,
    availableToday,
    trustedGuides,
    toursNearYou: trips.slice(0, 6),
  };
}
