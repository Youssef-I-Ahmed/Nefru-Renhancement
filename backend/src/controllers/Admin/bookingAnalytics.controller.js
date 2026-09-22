import mongoose from "mongoose";

import { Booking } from "../../models/booking.model.js";
import { BookingSeat } from "../../models/bookingSeat.model.js";
import { GuideProfile } from "../../models/guide.model.js";
import { TouristProfile } from "../../models/tourist.model.js";
import { Trip } from "../../models/trip.model.js";
import { User } from "../../models/user.model.js";
import { expirePendingBookings } from "../../services/Booking.service.js";

const PAGE_LIMIT = 12;
const BOOKING_STATUSES = new Set([
  "pending_payment",
  "confirmed",
  "completed",
  "cancelled",
  "expired",
  "refunded",
  "no_show",
]);
const PAYMENT_STATUSES = new Set([
  "unpaid",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
]);
const ANALYTICS_RANGES = new Set([30, 90, 365]);

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function buildPagingView(currentPage, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const values = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...values].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
}

async function profilesForBookings(bookings) {
  const touristIds = [...new Set(bookings.map((item) => String(item.tourist?._id || item.tourist || "")).filter(Boolean))];
  const guideIds = [...new Set(bookings.map((item) => String(item.guide?._id || item.guide || "")).filter(Boolean))];

  const [touristProfiles, guideProfiles] = await Promise.all([
    TouristProfile.find({ user: { $in: touristIds } }).select("user fullName avatar phoneNumber nationality").lean(),
    GuideProfile.find({ user: { $in: guideIds } }).select("user fullName avatar verificationStatus rating").lean(),
  ]);

  return {
    tourists: new Map(touristProfiles.map((profile) => [String(profile.user), profile])),
    guides: new Map(guideProfiles.map((profile) => [String(profile.user), profile])),
  };
}

function serializeBooking(booking, profiles = { tourists: new Map(), guides: new Map() }) {
  const touristId = String(booking.tourist?._id || booking.tourist || "");
  const guideId = String(booking.guide?._id || booking.guide || "");
  const touristProfile = profiles.tourists.get(touristId);
  const guideProfile = profiles.guides.get(guideId);

  return {
    id: booking._id,
    trip: {
      id: booking.trip?._id || booking.trip || null,
      title: booking.trip?.title || "Deleted trip",
      location: booking.trip?.location || "",
      image: booking.trip?.image || "",
    },
    tourist: {
      id: booking.tourist?._id || booking.tourist || null,
      name: touristProfile?.fullName || booking.tourist?.email || "Traveler",
      email: booking.tourist?.email || "",
      phoneNumber: touristProfile?.phoneNumber || "",
      avatar: touristProfile?.avatar || "",
      nationality: touristProfile?.nationality || "",
    },
    guide: {
      id: booking.guide?._id || booking.guide || null,
      name: guideProfile?.fullName || booking.guide?.email || "Guide",
      email: booking.guide?.email || "",
      avatar: guideProfile?.avatar || "",
      verificationStatus: guideProfile?.verificationStatus || "",
      rating: Number(guideProfile?.rating || 0),
    },
    occurrenceKey: booking.occurrenceKey,
    slotDate: booking.slotDate,
    date: booking.date,
    endAt: booking.endAt,
    timeSlot: booking.timeSlot,
    numberOfGuests: booking.numberOfGuests,
    pricePerPerson: booking.pricePerPerson,
    totalPrice: booking.totalPrice,
    platformFee: booking.platformFee,
    guideEarnings: booking.guideEarnings,
    currency: booking.currency || "EGP",
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentProvider: booking.paymentProvider || "none",
    paymentMethod: booking.paymentMethod || "none",
    paymentReference: booking.paymentReference || "",
    paymobIntentionId: booking.paymobIntentionId || "",
    paymobOrderId: booking.paymobOrderId || "",
    paymobTransactionId: booking.paymobTransactionId || "",
    legacyStripeReference: booking.stripePaymentIntentId || "",
    specialRequests: booking.specialRequests || [],
    bookingSource: booking.bookingSource || "web",
    holdExpiresAt: booking.holdExpiresAt,
    cancellationReason: booking.cancellationReason || "",
    cancelledBy: booking.cancelledBy || "",
    cancelledAt: booking.cancelledAt,
    completedAt: booking.completedAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

async function buildSearchFilter(query) {
  const q = String(query || "").trim();
  if (!q) return {};

  const regex = new RegExp(escapeRegex(q), "i");
  const [tripIds, userIds] = await Promise.all([
    Trip.find({ $or: [{ title: regex }, { location: regex }] }).select("_id").limit(100).lean(),
    User.find({ email: regex }).select("_id").limit(100).lean(),
  ]);

  const clauses = [
    { occurrenceKey: regex },
    { paymentReference: regex },
    { paymobIntentionId: regex },
    { paymobOrderId: regex },
    { paymobTransactionId: regex },
  ];
  if (mongoose.isValidObjectId(q)) clauses.push({ _id: q });
  if (tripIds.length) clauses.push({ trip: { $in: tripIds.map((item) => item._id) } });
  if (userIds.length) {
    const ids = userIds.map((item) => item._id);
    clauses.push({ tourist: { $in: ids } }, { guide: { $in: ids } });
  }
  return { $or: clauses };
}

async function getOperationalStats() {
  const now = new Date();
  const [total, paid, pendingPayment, failed, completed, cancelled, paidMoney] = await Promise.all([
    Booking.countDocuments(),
    Booking.countDocuments({ paymentStatus: "paid", currency: "EGP" }),
    Booking.countDocuments({ status: "pending_payment", holdExpiresAt: { $gt: now } }),
    Booking.countDocuments({ paymentStatus: "failed" }),
    Booking.countDocuments({ status: "completed" }),
    Booking.countDocuments({ status: "cancelled" }),
    Booking.aggregate([
      { $match: { paymentStatus: "paid", currency: "EGP" } },
      {
        $group: {
          _id: null,
          gross: { $sum: "$totalPrice" },
          platformFees: { $sum: "$platformFee" },
          guideEarnings: { $sum: "$guideEarnings" },
        },
      },
    ]),
  ]);
  return {
    total,
    paid,
    pendingPayment,
    failed,
    completed,
    cancelled,
    grossPaid: roundMoney(paidMoney[0]?.gross),
    platformFees: roundMoney(paidMoney[0]?.platformFees),
    guideEarnings: roundMoney(paidMoney[0]?.guideEarnings),
  };
}

export async function listAdminBookingOperations(req, res) {
  try {
    await expirePendingBookings();

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const bookingStatus = String(req.query.bookingStatus || "all").trim();
    const paymentStatus = String(req.query.paymentStatus || "all").trim();
    const provider = String(req.query.provider || "all").trim();

    if (bookingStatus !== "all" && !BOOKING_STATUSES.has(bookingStatus)) {
      return res.status(400).json({ success: false, message: "Invalid booking status filter" });
    }
    if (paymentStatus !== "all" && !PAYMENT_STATUSES.has(paymentStatus)) {
      return res.status(400).json({ success: false, message: "Invalid payment status filter" });
    }
    if (!["all", "paymob", "none"].includes(provider)) {
      return res.status(400).json({ success: false, message: "Invalid payment provider filter" });
    }

    const filter = await buildSearchFilter(req.query.q);
    if (bookingStatus !== "all") filter.status = bookingStatus;
    if (paymentStatus !== "all") filter.paymentStatus = paymentStatus;
    if (provider !== "all") filter.paymentProvider = provider;

    const [bookings, totalRecords, stats] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_LIMIT)
        .limit(PAGE_LIMIT)
        .populate("trip", "title location image")
        .populate("tourist", "email status")
        .populate("guide", "email status")
        .lean(),
      Booking.countDocuments(filter),
      getOperationalStats(),
    ]);
    const profiles = await profilesForBookings(bookings);
    const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_LIMIT));

    return res.status(200).json({
      success: true,
      data: bookings.map((booking) => serializeBooking(booking, profiles)),
      meta: {
        page,
        totalPages,
        totalRecords,
        pagingView: buildPagingView(page, totalPages),
        stats,
      },
    });
  } catch (error) {
    console.error("Admin booking operations list failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load booking operations" });
  }
}

export async function getAdminBookingOperation(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }
    await expirePendingBookings({ _id: req.params.id });

    const booking = await Booking.findById(req.params.id)
      .populate("trip", "title location image category duration groupSize status")
      .populate("tourist", "email status createdAt")
      .populate("guide", "email status createdAt")
      .lean();
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const [profiles, seat] = await Promise.all([
      profilesForBookings([booking]),
      BookingSeat.findOne({ booking: booking._id }).select("seatNumber expiresAt occurrenceKey").lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...serializeBooking(booking, profiles),
        seat: seat
          ? { seatNumber: seat.seatNumber, expiresAt: seat.expiresAt, occurrenceKey: seat.occurrenceKey }
          : null,
      },
    });
  } catch (error) {
    console.error("Admin booking operation detail failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load booking details" });
  }
}

function startDateForRange(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
}

function fillDailySeries(rows, since, days) {
  const byDay = new Map(rows.map((item) => [item._id, item]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(since);
    date.setDate(since.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const row = byDay.get(key) || {};
    return {
      date: key,
      bookings: Number(row.bookings || 0),
      paidBookings: Number(row.paidBookings || 0),
      paidRevenue: roundMoney(row.paidRevenue),
      platformFees: roundMoney(row.platformFees),
    };
  });
}

export async function getAdminAnalytics(req, res) {
  try {
    await expirePendingBookings();
    const requestedDays = Number.parseInt(req.query.days, 10) || 30;
    const days = ANALYTICS_RANGES.has(requestedDays) ? requestedDays : 30;
    const since = startDateForRange(days);

    const [
      dailyRows,
      bookingStatusRows,
      paymentStatusRows,
      providerRows,
      paidSummary,
      topTours,
      topGuides,
      userGrowthRows,
    ] = await Promise.all([
      Booking.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            bookings: { $sum: 1 },
            paidBookings: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentStatus", "paid"] }, { $eq: ["$currency", "EGP"] }] }, 1, 0] } },
            paidRevenue: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentStatus", "paid"] }, { $eq: ["$currency", "EGP"] }] }, "$totalPrice", 0] } },
            platformFees: { $sum: { $cond: [{ $and: [{ $eq: ["$paymentStatus", "paid"] }, { $eq: ["$currency", "EGP"] }] }, "$platformFee", 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$paymentProvider", count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: since }, paymentStatus: "paid", currency: "EGP" } },
        {
          $group: {
            _id: null,
            paidBookings: { $sum: 1 },
            grossRevenue: { $sum: "$totalPrice" },
            platformFees: { $sum: "$platformFee" },
            guideEarnings: { $sum: "$guideEarnings" },
            avgBookingValue: { $avg: "$totalPrice" },
          },
        },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: since }, paymentStatus: "paid", currency: "EGP" } },
        {
          $group: {
            _id: "$trip",
            bookings: { $sum: 1 },
            revenue: { $sum: "$totalPrice" },
          },
        },
        { $sort: { revenue: -1, bookings: -1 } },
        { $limit: 5 },
        { $lookup: { from: "trips", localField: "_id", foreignField: "_id", as: "trip" } },
        { $unwind: { path: "$trip", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            id: "$_id",
            _id: 0,
            title: { $ifNull: ["$trip.title", "Deleted trip"] },
            location: { $ifNull: ["$trip.location", ""] },
            bookings: 1,
            revenue: 1,
          },
        },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: since }, paymentStatus: "paid", currency: "EGP" } },
        {
          $group: {
            _id: "$guide",
            bookings: { $sum: 1 },
            guideEarnings: { $sum: "$guideEarnings" },
            grossRevenue: { $sum: "$totalPrice" },
          },
        },
        { $sort: { grossRevenue: -1, bookings: -1 } },
        { $limit: 5 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "guideprofiles", localField: "_id", foreignField: "user", as: "profile" } },
        { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            id: "$_id",
            _id: 0,
            name: { $ifNull: ["$profile.fullName", "$user.email"] },
            email: { $ifNull: ["$user.email", ""] },
            bookings: 1,
            guideEarnings: 1,
            grossRevenue: 1,
          },
        },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            users: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const series = fillDailySeries(dailyRows, since, days);
    const totalBookings = series.reduce((sum, item) => sum + item.bookings, 0);
    const paid = paidSummary[0] || {};
    const status = Object.fromEntries(bookingStatusRows.map((item) => [item._id, item.count]));
    const payment = Object.fromEntries(paymentStatusRows.map((item) => [item._id, item.count]));
    const providers = Object.fromEntries(providerRows.map((item) => [item._id || "none", item.count]));
    const completed = Number(status.completed || 0);
    const cancelled = Number(status.cancelled || 0) + Number(status.expired || 0) + Number(status.no_show || 0);

    const growthByDay = new Map(userGrowthRows.map((item) => [item._id, item.users]));
    const userGrowth = series.map((item) => ({ date: item.date, users: growthByDay.get(item.date) || 0 }));

    return res.status(200).json({
      success: true,
      data: {
        rangeDays: days,
        summary: {
          totalBookings,
          paidBookings: Number(paid.paidBookings || 0),
          paidConversionRate: totalBookings ? roundMoney((Number(paid.paidBookings || 0) / totalBookings) * 100) : 0,
          grossRevenue: roundMoney(paid.grossRevenue),
          platformFees: roundMoney(paid.platformFees),
          guideEarnings: roundMoney(paid.guideEarnings),
          avgBookingValue: roundMoney(paid.avgBookingValue),
          completionRate: totalBookings ? roundMoney((completed / totalBookings) * 100) : 0,
          cancellationRate: totalBookings ? roundMoney((cancelled / totalBookings) * 100) : 0,
        },
        series,
        userGrowth,
        bookingStatus: status,
        paymentStatus: payment,
        paymentProviders: providers,
        topTours: topTours.map((item) => ({ ...item, revenue: roundMoney(item.revenue) })),
        topGuides: topGuides.map((item) => ({
          ...item,
          guideEarnings: roundMoney(item.guideEarnings),
          grossRevenue: roundMoney(item.grossRevenue),
        })),
      },
    });
  } catch (error) {
    console.error("Admin analytics failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load analytics" });
  }
}
