import { Booking } from "../models/booking.model.js";
import { BookingSeat } from "../models/bookingSeat.model.js";
import { Trip } from "../models/trip.model.js";
import { User } from "../models/user.model.js";
import { Occurrence } from "../models/occurrence.model.js";
import {
  atomic,
  assertBookable,
  audit,
  signal,
} from "./marketplace.service.js";
import {
  accountActive,
  demand,
  cancellationEntitlement,
} from "../domain/policies.js";
import { findOccurrence, occurrenceDateTime } from "../utils/tripSchedule.js";
export async function expireHolds(extraQuery = {}) {
  const candidates = await Booking.find({
    ...extraQuery,
    status: "pending_payment",
    paymentStatus: { $ne: "paid" },
    holdExpiresAt: { $lte: new Date() },
  })
    .select("_id")
    .lean();
  const ids = [];
  for (const candidate of candidates)
    await atomic(async (session) => {
      const b = await Booking.findOne({
        _id: candidate._id,
        status: "pending_payment",
        paymentStatus: { $ne: "paid" },
        holdExpiresAt: { $lte: new Date() },
      }).session(session);
      if (!b) return;
      b.status = "expired";
      b.paymentStatus = "failed";
      b.cancelledBy = "system";
      b.cancellationReason = "Payment window expired";
      b.cancelledAt = new Date();
      b.holdExpiresAt = null;
      await b.save({ session });
      await BookingSeat.deleteOne({ booking: b._id }, { session });
      await audit(session, null, "hold_expired", "Booking", b);
      ids.push(b._id);
    });
  return ids;
}
export async function reserve(data, tourist) {
  demand(
    tourist?.role === "tourist" && accountActive(tourist),
    "Active tourist required",
    403,
  );
  demand(typeof data.occurrenceKey === "string", "Choose a date and time", 400);
  demand(
    data.numberOfGuests === undefined || Number(data.numberOfGuests) === 1,
    "One account reserves one seat",
    400,
  );
  await expireHolds({ trip: data.tripId, occurrenceKey: data.occurrenceKey });
  return atomic(async (session) => {
    const currentTourist = await User.findById(tourist._id).session(session);
    demand(
      currentTourist?.role === "tourist" && accountActive(currentTourist),
      "Active tourist required",
      403,
    );
    const trip = await Trip.findById(data.tripId).session(session);
    demand(trip, "Trip not found", 404);
    await assertBookable(trip, session);
    demand(
      !trip.identityVerificationRequired,
      "This experience requires identity approval before booking",
      409,
      "IDENTITY_REQUIRED",
    );
    const { occurrence: slot } = findOccurrence(trip, data.occurrenceKey);
    demand(slot, "Unknown occurrence", 404);
    const startsAt = occurrenceDateTime(slot.date, slot.startTime),
      endsAt = occurrenceDateTime(slot.date, slot.endTime);
    demand(
      startsAt > new Date() && endsAt > startsAt,
      "Occurrence has started or is invalid",
    );
    const occurrence = await Occurrence.findOneAndUpdate(
      { trip: trip._id, occurrenceKey: slot.occurrenceKey },
      {
        $setOnInsert: {
          guide: trip.guide,
          startsAt,
          endsAt,
          capacity: slot.capacity,
          status: "upcoming",
          publishedVersion: trip.publishedVersion || 1,
        },
      },
      { upsert: true, new: true, session },
    );
    demand(
      ["upcoming", "check_in_open"].includes(occurrence.status),
      "Occurrence is not bookable",
    );
    demand(
      !(await Booking.exists({
        trip: trip._id,
        tourist: tourist._id,
        occurrenceKey: slot.occurrenceKey,
        status: { $in: ["pending_payment", "confirmed"] },
      }).session(session)),
      "Already reserved",
      409,
      "DUPLICATE_BOOKING",
    );
    const seats = await BookingSeat.find({
      trip: trip._id,
      occurrenceKey: slot.occurrenceKey,
    })
      .select("seatNumber")
      .session(session)
      .lean();
    let seat = 1;
    while (seats.some((s) => s.seatNumber === seat)) seat++;
    demand(seat <= occurrence.capacity, "Occurrence is full", 409, "SLOT_FULL");
    const commission = Number(process.env.PLATFORM_COMMISSION_BPS || 0);
    demand(
      Number.isInteger(commission) && commission >= 0 && commission <= 10000,
      "Invalid commission configuration",
      503,
    );
    const fee = Math.round(((trip.price * commission) / 10000) * 100) / 100;
    const [booking] = await Booking.create(
      [
        {
          trip: trip._id,
          guide: trip.guide,
          tourist: tourist._id,
          occurrence: occurrence._id,
          occurrenceKey: slot.occurrenceKey,
          slotDate: slot.date,
          date: startsAt,
          endAt: endsAt,
          timeSlot: slot.startTime + " - " + slot.endTime,
          numberOfGuests: 1,
          pricePerPerson: trip.price,
          totalPrice: trip.price,
          platformFee: fee,
          guideEarnings: trip.price - fee,
          platformCommissionBps: commission,
          currency: "EGP",
          status: "pending_payment",
          paymentStatus: "unpaid",
          paymentProvider: "none",
          holdExpiresAt: new Date(Date.now() + 15 * 60000),
          specialRequests: data.specialRequest
            ? [String(data.specialRequest).slice(0, 500)]
            : [],
          publishedVersion: trip.publishedVersion || 1,
          tripSnapshot: {
            title: trip.title,
            location: trip.location,
            duration: trip.duration,
            image: trip.image,
            price: trip.price,
            currency: "EGP",
            guide: trip.guide,
          },
          policySnapshot: {
            version: 1,
            touristFullRefundHours:
              Number(process.env.TOURIST_REFUND_HOURS) || 24,
            disputeWindowHours: Number(process.env.DISPUTE_WINDOW_HOURS) || 24,
            platformCommissionBps: commission,
          },
          attendance: { status: "booked" },
        },
      ],
      { session },
    );
    await BookingSeat.create(
      [
        {
          booking: booking._id,
          trip: trip._id,
          tourist: tourist._id,
          occurrenceKey: slot.occurrenceKey,
          seatNumber: seat,
          expiresAt: null,
        },
      ],
      { session },
    );
    await Trip.updateOne(
      { _id: trip._id },
      { $inc: { bookingFence: 1 } },
      { session },
    );
    await User.updateOne(
      { _id: trip.guide },
      { $inc: { bookingFence: 1 } },
      { session },
    );
    // Conflict with concurrent suspension/closure so transaction retries recheck eligibility.
    await User.updateOne(
      { _id: currentTourist._id },
      { $inc: { bookingFence: 1 } },
      { session },
    );
    await Occurrence.updateOne(
      { _id: occurrence._id },
      { $inc: { bookingFence: 1 } },
      { session },
    );
    await audit(session, tourist, "booking_created", "Booking", booking);
    return { ...booking.toObject(), trip: trip.toObject() };
  });
}
export async function cancelReservation(id, tourist, reason = "") {
  return atomic(async (session) => {
    const b = await Booking.findOne({ _id: id, tourist: tourist._id }).session(
      session,
    );
    demand(
      b && ["pending_payment", "confirmed"].includes(b.status),
      "Active booking not found",
      404,
    );
    demand(b.date > new Date(), "Experience already started");
    b.refundEntitlement = cancellationEntitlement(b, "tourist");
    b.status = "cancelled";
    b.cancelledBy = "tourist";
    b.cancelledAt = new Date();
    b.cancellationReason = String(reason).slice(0, 500);
    b.holdExpiresAt = null;
    await b.save({ session });
    await BookingSeat.deleteOne({ booking: b._id }, { session });
    await signal(
      session,
      tourist,
      "booking_cancelled",
      "Booking",
      b,
      b.guide,
      {},
      reason,
    );
    return b.toObject();
  });
}
