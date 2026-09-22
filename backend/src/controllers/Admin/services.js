import { Booking } from "../../models/booking.model.js";
import { GuideProfile } from "../../models/guide.model.js";
import { GuideVerification } from "../../models/guideVerification.model.js";
import { Trip } from "../../models/trip.model.js";
import { User } from "../../models/user.model.js";

const CHART_DAYS = 30;

function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

async function getBookingSeries() {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (CHART_DAYS - 1));

  const daily = await Booking.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        bookings: { $sum: 1 },
        paidRevenue: {
          $sum: {
            $cond: [{ $and: [{ $eq: ["$paymentStatus", "paid"] }, { $eq: ["$currency", "EGP"] }] }, "$totalPrice", 0],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byDay = new Map(daily.map((item) => [item._id, item]));
  const labels = [];
  const bookingValues = [];
  const revenueValues = [];

  for (let index = 0; index < CHART_DAYS; index += 1) {
    const day = new Date(since);
    day.setDate(since.getDate() + index);
    const key = dateKey(day);
    labels.push(key.slice(5));
    bookingValues.push(byDay.get(key)?.bookings || 0);
    revenueValues.push(Math.round((byDay.get(key)?.paidRevenue || 0) * 100) / 100);
  }

  return { labels, bookingValues, revenueValues };
}

async function getStatusCounts(Model, field, values, match = {}) {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ]);
  const map = new Map(rows.map((item) => [item._id, item.count]));
  return Object.fromEntries(values.map((value) => [value, map.get(value) || 0]));
}

export const getDashboardData = async () => {
  const [
    userRoleCountsRows,
    totalTours,
    tourStatus,
    totalBookings,
    bookingStatus,
    paymentStatus,
    paidRevenueRows,
    topTours,
    recentBookings,
    pendingGuides,
    guideVerificationStatus,
    series,
  ] = await Promise.all([
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    Trip.countDocuments(),
    getStatusCounts(Trip, "status", ["draft", "reviewing", "active", "pending", "approved", "rejected"]),
    Booking.countDocuments(),
    getStatusCounts(Booking, "status", ["pending_payment", "confirmed", "completed", "cancelled", "expired", "refunded", "no_show"]),
    getStatusCounts(Booking, "paymentStatus", ["unpaid", "paid", "failed", "refunded", "partially_refunded"]),
    Booking.aggregate([
      { $match: { paymentStatus: "paid", currency: "EGP" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]),
    Trip.find({ status: "active" })
      .sort({ rating: -1, reviewsCount: -1, createdAt: -1 })
      .limit(5)
      .select("title location rating reviewsCount image price category createdAt")
      .lean(),
    Booking.find({ status: { $ne: "expired" } })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("trip", "title location")
      .populate("tourist", "email")
      .populate("guide", "email")
      .lean(),
    GuideProfile.find({ verificationStatus: "pending" })
      .sort({ updatedAt: 1 })
      .limit(6)
      .populate("user", "email status createdAt")
      .select("fullName avatar location verificationStatus user updatedAt")
      .lean(),
    getStatusCounts(GuideProfile, "verificationStatus", ["draft", "pending", "approved", "rejected"]),
    getBookingSeries(),
  ]);

  const userRoleCounts = { tourist: 0, guide: 0, admin: 0 };
  userRoleCountsRows.forEach((item) => {
    if (Object.hasOwn(userRoleCounts, item._id)) userRoleCounts[item._id] = item.count;
  });
  const totalUsers = Object.values(userRoleCounts).reduce((sum, value) => sum + value, 0);

  const pendingProfileIds = pendingGuides.map((guide) => guide._id);
  const pendingVerificationRows = pendingProfileIds.length
    ? await GuideVerification.find({ guideProfile: { $in: pendingProfileIds } })
        .select("guideProfile submittedAt updatedAt")
        .lean()
    : [];
  const verificationByGuide = new Map(
    pendingVerificationRows.map((item) => [String(item.guideProfile), item]),
  );

  const awaitingTourReview = (tourStatus.reviewing || 0) + (tourStatus.pending || 0);
  const paidRevenue = Math.round((paidRevenueRows[0]?.total || 0) * 100) / 100;

  return {
    summary: {
      totalUsers,
      totalTours,
      totalBookings,
      paidRevenue,
      pendingGuideVerifications: guideVerificationStatus.pending || 0,
      toursAwaitingReview: awaitingTourReview,
      pendingPayments: bookingStatus.pending_payment || 0,
      confirmedBookings: bookingStatus.confirmed || 0,
    },
    users: userRoleCounts,
    tourStatus,
    bookingStatus,
    paymentStatus,
    guideVerificationStatus,
    series,
    pendingGuideApprovals: pendingGuides.map((guide) => ({
      id: guide._id,
      userId: guide.user?._id || guide.user,
      fullName: guide.fullName,
      email: guide.user?.email || "",
      accountStatus: guide.user?.status || "",
      location: guide.location || "",
      avatar: guide.avatar || "",
      verificationStatus: guide.verificationStatus,
      submittedAt: verificationByGuide.get(String(guide._id))?.submittedAt || guide.updatedAt,
    })),
    recentBookings: recentBookings.map((booking) => ({
      id: booking._id,
      title: booking.trip?.title || "Trip",
      location: booking.trip?.location || "",
      touristEmail: booking.tourist?.email || "",
      guideEmail: booking.guide?.email || "",
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      totalPrice: booking.totalPrice,
      currency: booking.currency || "EGP",
      createdAt: booking.createdAt,
    })),
    cards: [
      { title: "Total Users", counter: totalUsers },
      { title: "Total Tours", counter: totalTours },
      { title: "Total Bookings", counter: totalBookings },
      { title: "Revenue (EGP)", counter: paidRevenue },
    ],
    charts: [
      {
        type: "LineChart",
        title: "Bookings Overview",
        data: {
          datasets: [
            { label: "Bookings", values: series.bookingValues },
            { label: "Paid revenue", values: series.revenueValues },
          ],
          labels: series.labels,
        },
      },
      {
        type: "DoughnutChart",
        title: "Tours by Status",
        data: {
          labels: ["Active", "Reviewing", "Draft", "Rejected"],
          values: [tourStatus.active || 0, awaitingTourReview, tourStatus.draft || 0, tourStatus.rejected || 0],
        },
      },
    ],
    // Keep topTours as an array because the current Overview UI maps it directly.
    // The table metadata is exposed separately for backward-compatible consumers.
    topTours,
    topToursTable: {
      data: topTours,
      meta: {
        totalRecords: topTours.length,
        headers: ["IMAGE", "NAME", "LOCATION", "RATING", "CREATED AT"],
      },
    },
  };
};
