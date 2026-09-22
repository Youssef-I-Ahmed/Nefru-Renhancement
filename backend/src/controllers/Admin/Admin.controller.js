import {accountAction as accountActionService} from '../../services/marketplace.service.js';
import { legacyDelete as safeDelete, legacyBan as safeBan, legacyUnban as safeUnban, legacyGuideActivation as safeGuideActivation, legacyTripStatus as safeTripStatus } from '../marketplace.controller.js';
import mongoose from "mongoose";

import { User, USER_ROLES } from "../../models/user.model.js";
import { Trip } from "../../models/trip.model.js";
import { Booking } from "../../models/booking.model.js";
import { GuideProfile } from "../../models/guide.model.js";
import { TouristProfile } from "../../models/tourist.model.js";
import { GuideVerification } from "../../models/guideVerification.model.js";
import { Notification } from "../../models/notification.model.js";
import { sendEmail } from "../../utils/sendEmail.js";

import { getDashboardData } from "./services.js";

const USERS_PAGE_LIMIT = 10;
const TOURS_PAGE_LIMIT = 10;
const BOOKINGS_PAGE_LIMIT = 10;
const USER_STATUSES = ["active", "pending", "deactivated"];

export const getDashboard = async (req, res) => {
  try {
    const data = await getDashboardData();
    return res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data,
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while retrieving dashboard data",
      error: { code: "INTERNAL_SERVER_ERROR", details: [] },
    });
  }
};

function isValidObjectId(value) {
  return Boolean(value) && mongoose.Types.ObjectId.isValid(value);
}

// Shared windowed pagination view: [1, mid-1..mid+1, last]
function buildPagingView(currentPage, totalPages) {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  const view = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  return [1, ...view, totalPages];
}

export const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
        error: { code: "VALIDATION_ERROR", details: ["The provided user ID is not a valid format"] },
      });
    }

    const user = await User.findById(userId).populate(
      "profileId",
      "fullName avatar verificationStatus",
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        error: { code: "NO_CONTENT_ERROR", details: ["User not registered"] },
      });
    }

    const plain = user.toObject();
    return res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: {
        ...plain,
        fullName: plain.profileId?.fullName || "",
        avatar: plain.profileId?.avatar || "",
        verificationStatus: plain.profileId?.verificationStatus,
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while fetching account",
      error: { code: "INTERNAL_SERVER_ERROR", details: [] },
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { role, page } = req.query;

    if (!role || !page || !USER_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
        error: { code: "INVALID_REQUEST", details: [`role must be one of: ${USER_ROLES.join(", ")}, page must be a positive integer`] },
      });
    }

    const currentPage = parseInt(page, 10);
    if (isNaN(currentPage) || currentPage < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid page parameter",
        error: { code: "VALIDATION_ERROR", details: ["Page must be a positive integer"] },
      });
    }

    const SKIP = (currentPage - 1) * USERS_PAGE_LIMIT;

    const [users, total, touristCount, guideCount, adminCount] = await Promise.all([
      User.find({ role })
        .sort({ createdAt: -1 })
        .skip(SKIP)
        .limit(USERS_PAGE_LIMIT)
        .populate("profileId", "fullName avatar verificationStatus"),
      User.countDocuments({ role }),
      User.countDocuments({ role: "tourist" }),
      User.countDocuments({ role: "guide" }),
      User.countDocuments({ role: "admin" }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_LIMIT));

    // Guides get an extra verification column.
    const headers =
      role === "guide"
        ? ["USER", "EMAIL", "JOINED", "VERIFICATION", "STATUS"]
        : ["USER", "EMAIL", "JOINED", "STATUS"];

    // Flatten profile fields so clients render rows without extra lookups.
    const rows = users.map((user) => {
      const plain = user.toObject();
      return {
        ...plain,
        fullName: plain.profileId?.fullName || "",
        avatar: plain.profileId?.avatar || "",
        verificationStatus: plain.profileId?.verificationStatus,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: rows,
      meta: {
        totalRecords: total,
        totalPages,
        recordsCount: rows.length,
        currentPage,
        pagingView: buildPagingView(currentPage, totalPages),
        headers,
        types: USER_ROLES,
        roleCounts: { tourist: touristCount, guide: guideCount, admin: adminCount },
      },
    });
  } catch (error) {
    console.error("Error listing accounts:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while fetching accounts",
      error: { code: "INTERNAL_SERVER_ERROR", details: [] },
    });
  }
};

// Only a controlled set of fields may be edited via this endpoint.
// Role/status escalation and password changes must go through dedicated flows.
const USER_EDITABLE_FIELDS = ["status"];

export const updateUserById=async(req,res,next)=>{try{const action={active:'restore',deactivated:'suspend'}[req.body.status];if(!action)throw new Error('Use an explicit account action');const data=await accountActionService(req.params.id,action,req.user,req.body.reason||'Administrative account update');res.json({success:true,data});}catch(error){next(error);}};

export const banUserById = safeBan;

export const unbanUserById = safeUnban;



export const deleteUserById = safeDelete;

export const guideActivation = safeGuideActivation;

export const getAllTours = async (req, res) => {
  try {
    const currentPage = parseInt(req.params.page, 10);
    if (isNaN(currentPage) || currentPage < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid page parameter",
        error: { code: "VALIDATION_ERROR", details: ["Page must be a positive integer"] },
      });
    }

    // Publication state: published = publicly visible ("active"),
    // unpublished = every other status (draft/reviewing/pending/approved/rejected).
    const state = String(req.query.state || "all").toLowerCase();
    const filter = {};
    if (state === "published") {
      filter.status = "active";
    } else if (state === "unpublished") {
      filter.status = { $ne: "active" };
    } else if (state !== "all") {
      return res.status(400).json({
        success: false,
        message: "Invalid state parameter",
        error: { code: "VALIDATION_ERROR", details: ["state must be one of: all, published, unpublished"] },
      });
    }

    const SKIP = (currentPage - 1) * TOURS_PAGE_LIMIT;

    const [trips, total, totalCount, publishedCount, awaitingReviewCount] = await Promise.all([
      Trip.find(filter)
        .sort({ createdAt: -1 })
        .skip(SKIP)
        .limit(TOURS_PAGE_LIMIT)
        .select("title location status rating image category price createdAt")
        .lean(),
      Trip.countDocuments(filter),
      Trip.countDocuments(),
      Trip.countDocuments({ status: "active" }),
      Trip.countDocuments({ status: { $in: ["reviewing", "pending"] } }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / TOURS_PAGE_LIMIT));

    return res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: trips,
      meta: {
        totalRecords: total,
        totalPages,
        recordsCount: trips.length,
        currentPage,
        pagingView: buildPagingView(currentPage, totalPages),
        headers: ["IMAGE", "NAME", "LOCATION", "STATUS", "RATE"],
        types: ["all", "published", "unpublished"],
        stats: {
          total: totalCount,
          published: publishedCount,
          unpublished: totalCount - publishedCount,
          awaitingReview: awaitingReviewCount,
        },
      },
    });
  } catch (error) {
    console.error("Error listing tours:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while fetching tours",
      error: { code: "INTERNAL_SERVER_ERROR", details: [] },
    });
  }
}

export const getTourById = async (req, res) => {
  try {
    const tripId = req.params.id;
    if (!isValidObjectId(tripId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid trip ID",
        error: { code: "VALIDATION_ERROR", details: ["The provided trip ID is not a valid format"] },
      });
    }

    const trip = await Trip.findById(tripId).lean();
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
        error: { code: "NO_CONTENT_ERROR", details: ["Trip not registered"] },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: trip,
    });
  } catch (error) {
    console.error("Error fetching tour:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while fetching tour",
      error: { code: "INTERNAL_SERVER_ERROR", details: [] },
    });
  }
}

// Trip moderation / publication. Public visibility requires status "active".
// Primary actions: publish -> active, hide -> draft (unpublished), reject.
// approve/suspend kept as legacy aliases of publish/hide.
const TRIP_ACTION_MAP = {
  publish: "active",
  hide: "draft",
  reject: "rejected",
  approve: "active",
  suspend: "draft",
};

export const updateTripStatus = safeTripStatus;

// Read-only bookings list for the admin Booking page.
export const getBookings = async (req, res) => {
  try {
    const currentPage = parseInt(req.params.page, 10);
    if (isNaN(currentPage) || currentPage < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid page parameter",
        error: { code: "VALIDATION_ERROR", details: ["Page must be a positive integer"] },
      });
    }

    const SKIP = (currentPage - 1) * BOOKINGS_PAGE_LIMIT;

    const [
      bookings,
      total,
      confirmedCount,
      completedCount,
      cancelledCount,
      pendingPaymentCount,
      revenueAgg,
    ] = await Promise.all([
      Booking.find()
        .sort({ createdAt: -1 })
        .skip(SKIP)
        .limit(BOOKINGS_PAGE_LIMIT)
        .populate("trip", "title location image")
        .populate("tourist", "email")
        .populate("guide", "email")
        .lean(),
      Booking.countDocuments(),
      Booking.countDocuments({ status: "confirmed" }),
      Booking.countDocuments({ status: "completed" }),
      Booking.countDocuments({ status: "cancelled" }),
      Booking.countDocuments({ status: "pending_payment" }),
      Booking.aggregate([
        { $match: { paymentStatus: "paid", currency: "EGP" } },
        { $group: { _id: null, total: { $sum: "$totalPrice" } } },
      ]),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / BOOKINGS_PAGE_LIMIT));

    const rows = bookings.map((booking) => ({
      _id: booking._id,
      tripTitle: booking.trip?.title || "Deleted trip",
      tripImage: booking.trip?.image || "",
      touristEmail: booking.tourist?.email || "",
      guideEmail: booking.guide?.email || "",
      slotDate: booking.slotDate,
      timeSlot: booking.timeSlot,
      numberOfGuests: booking.numberOfGuests,
      totalPrice: booking.totalPrice,
      currency: booking.currency || "EGP",
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      createdAt: booking.createdAt,
    }));

    return res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: rows,
      meta: {
        totalRecords: total,
        totalPages,
        recordsCount: rows.length,
        currentPage,
        pagingView: buildPagingView(currentPage, totalPages),
        headers: ["TOUR", "TOURIST", "GUIDE", "DATE", "GUESTS", "TOTAL", "STATUS"],
        types: ["All"],
        stats: {
          total,
          confirmed: confirmedCount,
          completed: completedCount,
          cancelled: cancelledCount,
          pendingPayment: pendingPaymentCount,
          revenuePaid:
            Math.round((revenueAgg[0]?.total || 0) * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error("Error listing bookings:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while fetching bookings",
      error: { code: "INTERNAL_SERVER_ERROR", details: [] },
    });
  }
}
