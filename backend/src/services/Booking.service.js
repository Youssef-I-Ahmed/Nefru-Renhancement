import {reserve,expireHolds,cancelReservation} from './reservation.service.js';
import {assertBookable,actOnOccurrence} from './marketplace.service.js';
import {demand} from '../domain/policies.js';
import {Occurrence} from '../models/occurrence.model.js';
import mongoose from "mongoose";

import { Booking } from "../models/booking.model.js";
import { BookingSeat } from "../models/bookingSeat.model.js";
import { GuideProfile } from "../models/guide.model.js";
import { Notification } from "../models/notification.model.js";
import { TouristProfile } from "../models/tourist.model.js";
import { Trip } from "../models/trip.model.js";
import { AppError } from "../utils/AppError.js";
import {
  findOccurrence,
  normalizeTripSchedule,
  occurrenceDateTime,
} from "../utils/tripSchedule.js";

const HOLD_MINUTES = 15;
const ACTIVE_BOOKING_STATUSES = ["pending_payment", "confirmed"];

function assertObjectId(value, label = "ID") {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`Invalid ${label}`, 400, "INVALID_ID");
  }
}

function bookingView(booking, names = {}) {
  const trip = booking.tripSnapshot || booking.trip || {};
  const guide = booking.guide || {};
  const tourist = booking.tourist || {};
  const statusGroup = booking.status === "completed"
    ? "completed"
    : ["cancelled", "refunded", "no_show"].includes(booking.status)
      ? "cancelled"
      : "upcoming";

  return {
    id: booking._id,
    bookingId: booking._id,
    tripId: booking.trip?._id || booking.trip,
    occurrenceId:booking.occurrence,
    attendance:booking.attendance,
    refundEntitlement:booking.refundEntitlement,
    refundStatus:booking.refundStatus||"none",
    refundedAmount:Number(booking.refundedAmount||0),
    refundRequestedAmount:Number(booking.refundRequestedAmount||0),
    refundReason:booking.refundReason||"",
    refundRequestedAt:booking.refundRequestedAt||null,
    refundCompletedAt:booking.refundCompletedAt||null,
    refundFailureReason:booking.refundFailureReason||"",
    occurrenceKey: booking.occurrenceKey,
    title: trip.title || "Trip",
    image: trip.image || "",
    location: trip.location || "",
    duration: trip.duration || "",
    guide: names.guide || guide.email || "Nefru guide",
    tourist: names.tourist || tourist.email || "Nefru traveler",
    touristEmail: tourist.email || "",
    date: booking.slotDate,
    startsAt: booking.date,
    endsAt: booking.endAt,
    startTime: booking.timeSlot,
    price: booking.totalPrice,
    totalPrice: booking.totalPrice,
    platformFee: booking.platformFee || 0,
    guideEarnings: booking.guideEarnings ?? booking.totalPrice,
    earningsAvailableAt:booking.earningsAvailableAt,settlementStatus:booking.settlementStatus||"unsettled",settledAt:booking.settledAt,
    currency: booking.currency,
    displayCurrency: booking.displayCurrency || "EGP",
    displayAmount: booking.displayAmount ?? null,
    displayFxRate: booking.displayFxRate ?? null,
    fxRateUpdatedAt: booking.fxRateUpdatedAt || null,
    status: booking.status,
    statusGroup,
    paymentStatus: booking.paymentStatus,
    paymentProvider: booking.paymentProvider || "none",
    paymentMethod: booking.paymentMethod || "none",
    paymentReference: booking.paymentReference || "",
    holdExpiresAt: booking.holdExpiresAt,
    specialRequest: booking.specialRequests?.[0] || "",
    cancellationReason: booking.cancellationReason || "",
    cancelledBy: booking.cancelledBy || "",
    createdAt: booking.createdAt,
  };
}

async function namesForBookings(bookings) {
  const guideIds = bookings.map((item) => item.guide?._id || item.guide).filter(Boolean);
  const touristIds = bookings.map((item) => item.tourist?._id || item.tourist).filter(Boolean);
  const [guides, tourists] = await Promise.all([
    GuideProfile.find({ user: { $in: guideIds } }).select("user fullName").lean(),
    TouristProfile.find({ user: { $in: touristIds } }).select("user fullName").lean(),
  ]);
  return {
    guides: new Map(guides.map((item) => [item.user.toString(), item.fullName])),
    tourists: new Map(tourists.map((item) => [item.user.toString(), item.fullName])),
  };
}

function namesFor(booking, maps) {
  const guideId = booking.guide?._id || booking.guide;
  const touristId = booking.tourist?._id || booking.tourist;
  return {
    guide: guideId ? maps.guides.get(guideId.toString()) : "",
    tourist: touristId ? maps.tourists.get(touristId.toString()) : "",
  };
}

function notify(user, payload) {
  return Notification.create({ user, ...payload });
}

export const expirePendingBookings=expireHolds;



export async function getTripAvailability(tripId) {
  assertObjectId(tripId, "trip ID");
  await expirePendingBookings({ trip: tripId });
  const trip = await Trip.findOne({ _id: tripId, status: "active" }).lean();
  if (!trip) throw new AppError("Active trip not found", 404, "TRIP_NOT_FOUND");

  await assertBookable(trip);
  const closed=await Occurrence.find({trip:trip._id,status:{$nin:["upcoming","check_in_open"]}}).select("occurrenceKey").lean();
  const schedule = normalizeTripSchedule(trip.schedule, trip.groupSize || 1);
  const now = new Date();
  const futureSlots = schedule.slots.filter(
    (slot) => occurrenceDateTime(slot.date, slot.startTime) > now && !closed.some(o=>o.occurrenceKey===slot.occurrenceKey),
  );
  const counts = await BookingSeat.aggregate([
    {
      $match: {
        trip: trip._id,
        occurrenceKey: { $in: futureSlots.map((slot) => slot.occurrenceKey) },
      },
    },
    { $group: { _id: "$occurrenceKey", reserved: { $sum: 1 } } },
  ]);
  const reservedByOccurrence = new Map(counts.map((item) => [item._id, item.reserved]));
  const slots = futureSlots.map((slot) => {
    const reserved = reservedByOccurrence.get(slot.occurrenceKey) || 0;
    return {
      ...slot,
      reserved,
      availableSpots: Math.max(slot.capacity - reserved, 0),
      bookable: reserved < slot.capacity,
    };
  });
  const dates = [...new Set(slots.map((slot) => slot.date))];
  const slotsByDate = Object.fromEntries(
    dates.map((date) => [date, slots.filter((slot) => slot.date === date)]),
  );

  return {
    trip: {
      id: trip._id,
      title: trip.title,
      description: trip.description,
      longDescription: trip.longDescription || trip.description,
      location: trip.location,
      duration: trip.duration,
      image: trip.image,
      price: trip.price,
      currency: trip.currency || "EGP",
      groupSize: trip.groupSize,
    },
    holdMinutes: HOLD_MINUTES,
    schedule: { dates, slotsByDate, slots },
  };
}

export async function createBooking(data,tourist){assertObjectId(data.tripId);return bookingView(await reserve(data,tourist));}

export async function getBookingById(bookingId, user) {
  assertObjectId(bookingId, "booking ID");
  await expirePendingBookings({ _id: bookingId });
  const booking = await Booking.findById(bookingId)
    .populate("trip")
    .populate("tourist", "email")
    .populate("guide", "email")
    .lean();
  if (!booking || booking.status === "expired") {
    throw new AppError("Booking not found", 404, "BOOKING_NOT_FOUND");
  }
  const canView =
    user.role === "admin" ||
    booking.tourist?._id?.toString() === user._id.toString() ||
    booking.guide?._id?.toString() === user._id.toString();
  if (!canView) throw new AppError("You cannot view this booking", 403, "FORBIDDEN");
  const maps = await namesForBookings([booking]);
  return bookingView(booking, namesFor(booking, maps));
}

export async function getMyBookings(tourist) {
  await expirePendingBookings({ tourist: tourist._id });
  const bookings = await Booking.find({
    tourist: tourist._id,
    status: { $ne: "expired" },
  })
    .populate("trip")
    .populate("guide", "email")
    .populate("tourist", "email")
    .sort({ date: 1, createdAt: -1 })
    .lean();
  const maps = await namesForBookings(bookings);
  return bookings.map((booking) => bookingView(booking, namesFor(booking, maps)));
}

export async function getGuideBookings(guide) {
  await expirePendingBookings({ guide: guide._id });
  const bookings = await Booking.find({
    guide: guide._id,
    status: { $ne: "expired" },
  })
    .populate("trip")
    .populate("tourist", "email")
    .populate("guide", "email")
    .sort({ date: 1, createdAt: -1 })
    .lean();
  const maps = await namesForBookings(bookings);
  const serialized = bookings.map((booking) => bookingView(booking, namesFor(booking, maps)));
  const occurrences = new Map();

  serialized.forEach((booking) => {
    const groupKey = `${booking.tripId}:${booking.occurrenceKey}`;
    if (!occurrences.has(groupKey)) {
      const original = bookings.find((item) => item._id.toString() === booking.id.toString());
      const slot = normalizeTripSchedule(
        original?.trip?.schedule,
        original?.trip?.groupSize || 1,
      ).slots.find((item) => item.occurrenceKey === booking.occurrenceKey);
      occurrences.set(groupKey, {
        occurrenceKey: booking.occurrenceKey,
        occurrenceId:booking.occurrenceId,
        tripId: booking.tripId,
        title: booking.title,
        image: booking.image,
        location: booking.location,
        date: booking.date,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        startTime: slot?.startTime || booking.startTime.split(" - ")[0],
        endTime: slot?.endTime || booking.startTime.split(" - ")[1] || "",
        capacity: slot?.capacity || 1,
        bookings: [],
      });
    }
    occurrences.get(groupKey).bookings.push(booking);
  });

  return { bookings: serialized, occurrences: [...occurrences.values()] };
}

export async function cancelTouristBooking(id,tourist,reason=''){assertObjectId(id);return bookingView(await cancelReservation(id,tourist,reason));}

export async function completeOccurrence(tripId,occurrenceKey,guide){const o=await Occurrence.findOne({trip:tripId,occurrenceKey});demand(o,'Occurrence must be migrated first');return actOnOccurrence(o._id,'end',guide);}

export async function cancelGuideOccurrence(tripId,occurrenceKey,guide,reason){const o=await Occurrence.findOne({trip:tripId,occurrenceKey});demand(o,'Occurrence must be migrated first');return actOnOccurrence(o._id,'cancel',guide,reason);}

export { HOLD_MINUTES };
