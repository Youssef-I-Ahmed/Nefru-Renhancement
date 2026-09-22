import { legacyVerification as safeVerification } from '../marketplace.controller.js';
import mongoose from "mongoose";

import { Booking } from "../../models/booking.model.js";
import { GuideProfile } from "../../models/guide.model.js";
import { GuideVerification } from "../../models/guideVerification.model.js";
import { Notification } from "../../models/notification.model.js";
import { TouristProfile } from "../../models/tourist.model.js";
import { Trip } from "../../models/trip.model.js";
import { User } from "../../models/user.model.js";
import { sendEmail } from "../../utils/sendEmail.js";

const ACCOUNT_ROLES = new Set(["tourist", "guide", "admin"]);
const ACCOUNT_STATUSES = new Set(["active", "pending", "deactivated"]);
const VERIFICATION_STATUSES = new Set(["draft", "pending", "approved", "rejected"]);
const DOCUMENT_TYPES = new Set(["national_id", "passport", "guide_license"]);
const PAGE_LIMIT = 12;

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function serializeProfile(profile) {
  if (!profile) return null;
  return {
    id: profile._id,
    fullName: profile.fullName || "",
    avatar: profile.avatar || "",
    headline: profile.headline || "",
    location: profile.location || "",
    phoneNumber: profile.phoneNumber || "",
    nationality: profile.nationality || "",
    preferredLanguage: profile.preferredLanguage || "",
    yearsExperience: Number(profile.yearsExperience || 0),
    languages: Array.isArray(profile.languages) ? profile.languages : [],
    specialties: Array.isArray(profile.specialties) ? profile.specialties : [],
    rating: Number(profile.rating || 0),
    reviewsCount: Number(profile.reviewsCount || 0),
    verificationStatus: profile.verificationStatus,
    rejectionReason: profile.rejectionReason || "",
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function serializeVerification(verification) {
  if (!verification) {
    return {
      id: null,
      documents: [],
      requestedChanges: [],
      reviewHistory: [],
      submittedAt: null,
      reviewedAt: null,
    };
  }

  return {
    id: verification._id,
    documents: (verification.documents || []).map((document) => ({
      id: document._id,
      documentType: document.documentType,
      originalName: document.originalName,
      mimeType: document.mimeType,
      uploadedAt: document.uploadedAt,
      replacedAt: document.replacedAt,
    })),
    requestedChanges: (verification.requestedChanges || []).map((change) => ({
      id: change._id,
      documentType: change.documentType,
      message: change.message,
      resolvedAt: change.resolvedAt,
    })),
    reviewHistory: (verification.reviewHistory || []).map((entry) => ({
      id: entry._id,
      status: entry.status,
      reason: entry.reason || "",
      reviewedBy: entry.reviewedBy,
      reviewedAt: entry.reviewedAt,
    })),
    submittedAt: verification.submittedAt || null,
    reviewedAt: verification.reviewedAt || null,
  };
}

async function profileNameMatches(role, regex) {
  if (!regex) return null;

  if (role === "guide") {
    const profiles = await GuideProfile.find({ fullName: regex }).select("user").lean();
    return profiles.map((profile) => profile.user);
  }

  if (role === "tourist") {
    const profiles = await TouristProfile.find({ fullName: regex }).select("user").lean();
    return profiles.map((profile) => profile.user);
  }

  return null;
}

export async function listAdminAccounts(req, res) {
  try {
    const role = String(req.query.role || "tourist").toLowerCase();
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const query = String(req.query.q || "").trim().slice(0, 100);
    const status = String(req.query.status || "all").toLowerCase();
    const verification = String(req.query.verification || "all").toLowerCase();

    if (!ACCOUNT_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: "Invalid account role" });
    }
    if (status !== "all" && !ACCOUNT_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: "Invalid account status" });
    }
    if (verification !== "all" && !VERIFICATION_STATUSES.has(verification)) {
      return res.status(400).json({ success: false, message: "Invalid verification status" });
    }
    if (role !== "guide" && verification !== "all") {
      return res.status(400).json({ success: false, message: "Verification filter is only available for guides" });
    }

    const regex = query ? new RegExp(escapeRegex(query), "i") : null;
    const nameMatchIds = await profileNameMatches(role, regex);
    const verificationIds = role === "guide" && verification !== "all"
      ? (await GuideProfile.find({ verificationStatus: verification }).select("user").lean())
          .map((profile) => profile.user)
      : null;
    const filter = { role };

    if (status !== "all") filter.status = status;
    if (verificationIds) filter._id = { $in: verificationIds };
    if (regex) {
      filter.$or = [
        { email: regex },
        { _id: { $in: nameMatchIds || [] } },
      ];
    }

    const skip = (page - 1) * PAGE_LIMIT;
    const [users, total, touristCount, guideCount, adminCount, pendingVerification, deactivatedCount] =
      await Promise.all([
        User.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(PAGE_LIMIT)
          .select("email role status emailVerified authProviders profileId roleProfile createdAt updatedAt")
          .populate(
            "profileId",
            "fullName avatar headline location verificationStatus rating reviewsCount yearsExperience",
          )
          .lean(),
        User.countDocuments(filter),
        User.countDocuments({ role: "tourist" }),
        User.countDocuments({ role: "guide" }),
        User.countDocuments({ role: "admin" }),
        GuideProfile.countDocuments({ verificationStatus: "pending" }),
        User.countDocuments({ status: "deactivated" }),
      ]);

    const rows = users.map((user) => ({
      id: user._id,
      _id: user._id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: Boolean(user.emailVerified),
      authProviders: user.authProviders || [],
      fullName: user.profileId?.fullName || "",
      avatar: user.profileId?.avatar || "",
      headline: user.profileId?.headline || "",
      location: user.profileId?.location || "",
      verificationStatus: user.profileId?.verificationStatus || null,
      rating: user.profileId?.rating ?? null,
      reviewsCount: user.profileId?.reviewsCount ?? null,
      yearsExperience: user.profileId?.yearsExperience ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
    return res.status(200).json({
      success: true,
      data: { accounts: rows },
      meta: {
        page,
        pageSize: PAGE_LIMIT,
        totalRecords: total,
        totalPages,
        roleCounts: { tourist: touristCount, guide: guideCount, admin: adminCount },
        pendingVerification,
        deactivatedCount,
      },
    });
  } catch (error) {
    console.error("Admin account list error:", error);
    return res.status(500).json({ success: false, message: "Unable to load accounts" });
  }
}

export async function getAdminAccountReview(req, res) {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid account ID" });
    }

    const user = await User.findById(req.params.id)
      .select("email role status emailVerified authProviders profileId roleProfile createdAt updatedAt")
      .lean();
    if (!user) return res.status(404).json({ success: false, message: "Account not found" });

    let profile = null;
    let verification = null;
    let activity = { bookings: 0, tours: 0 };

    if (user.role === "guide") {
      profile = await GuideProfile.findOne({ user: user._id })
        .select("+rejectionReason")
        .lean();
      if (profile) {
        const verificationDoc = await GuideVerification.findOne({ guideProfile: profile._id })
          .select("+documents +requestedChanges +reviewHistory")
          .lean();
        verification = serializeVerification(verificationDoc);
      }
      const [bookings, tours] = await Promise.all([
        Booking.countDocuments({ guide: user._id }),
        Trip.countDocuments({ guide: user._id }),
      ]);
      activity = { bookings, tours };
    } else if (user.role === "tourist") {
      profile = await TouristProfile.findOne({ user: user._id }).lean();
      activity.bookings = await Booking.countDocuments({ tourist: user._id });
    }

    return res.status(200).json({
      success: true,
      data: {
        account: {
          id: user._id,
          email: user.email,
          role: user.role,
          status: user.status,
          emailVerified: Boolean(user.emailVerified),
          authProviders: user.authProviders || [],
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        profile: serializeProfile(profile),
        verification,
        activity,
      },
    });
  } catch (error) {
    console.error("Admin account detail error:", error);
    return res.status(500).json({ success: false, message: "Unable to load account details" });
  }
}





export const reviewAdminGuideVerification = safeVerification;
