import {accountActive,verificationValid} from '../domain/policies.js';
import mongoose from "mongoose";
import { GuideProfile } from "../models/guide.model.js";
import { Trip } from "../models/trip.model.js";
import { publicTrips } from './catalog.service.js';

const GUIDE_USER_FIELDS =
  "email status accountStatus createdAt authProviders emailVerified";

function toGuideResponse(guide, tours, { includePrivate = false } = {}) {
  const user = guide.user;
  const avatar = guide.avatar || "";

  const response = {
    id: guide._id,
    userId: user._id,
    name: guide.fullName,
    fullName: guide.fullName,
    avatar,
    profileImage: avatar,
    heroImage: guide.gallery?.[0]?.src || avatar,
    title: guide.headline,
    headline: guide.headline,
    location: guide.location,
    phoneNumber: guide.phoneNumber,
    gender: guide.gender,
    nationality: guide.nationality,
    dateOfBirth: guide.dateOfBirth,
    preferredLanguage: guide.preferredLanguage,
    verified: verificationValid(guide),
    verificationStatus: guide.verificationStatus,
    status: user.status,
    rating: guide.rating,
    reviewsCount: guide.reviewsCount,
    yearsExperience: guide.yearsExperience,
    languages: guide.languages,
    specialties: guide.specialties,
    about: guide.about,
    email: user.email,
    memberSince: user.createdAt,
    gallery: (guide.gallery || []).map((item) => ({
      id: item._id,
      src: item.src,
      alt: item.alt,
    })),
    tours: tours.map((trip) => ({
      id: trip._id,
      title: trip.title,
      image: trip.image,
      duration: trip.duration,
      price: trip.price,
      currency: trip.currency || "EGP",
      location: trip.location,
      category: trip.category,
      groupSize: trip.groupSize,
      rating: trip.rating,
      reviewsCount: trip.reviewsCount,
      status: trip.status,
    })),
    createdAt: guide.createdAt,
    updatedAt: guide.updatedAt,
  };

  if (includePrivate) {
    response.rejectionReason = guide.rejectionReason || "";
  }

  return response;
}

async function getGuideResponse(guideQuery, options = {}) {
  if (options.includePrivate) {
    guideQuery.select("+rejectionReason");
  }

  const guide = await guideQuery.populate("user", GUIDE_USER_FIELDS).lean();

  if (!guide?.user) return null;
  if(options.publicOnly && (!accountActive(guide.user)||!verificationValid(guide)))return null;

  const tourQuery = { guide: guide.user._id };
  if (options.publicOnly) tourQuery.status = "active";

  const tours = options.publicOnly ? await publicTrips({ guide: guide.user._id }) : await Trip.find(tourQuery)
    .select(
      "title image duration price currency location category groupSize rating reviewsCount status",
    )
    .sort({ createdAt: -1 })
    .lean();

  return toGuideResponse(guide, tours, options);
}

export async function getPublicGuideProfile(guideId) {
  if (!mongoose.isValidObjectId(guideId)) return null;

  // Trip payloads historically expose the guide User id while /guides/:id was
  // originally implemented around the GuideProfile id. Accept both identifiers so
  // existing clients and newer profile links resolve to the same public guide.
  const guide = await getGuideResponse(
    GuideProfile.findOne({
      $or: [{ _id: guideId }, { user: guideId }],
    }),
    { publicOnly: true },
  );

  if (!guide || guide.status !== "active" || !guide.verified) {
    return null;
  }

  const publicGuide = { ...guide };
  [
    "verificationStatus",
    "status",
    "userId",
    "phoneNumber",
    "dateOfBirth",
    "email",
    "gender",
    "nationality",
    "preferredLanguage",
  ].forEach((field) => delete publicGuide[field]);

  return publicGuide;
}

export async function getOwnGuideProfile(userId) {
  return getGuideResponse(GuideProfile.findOne({ user: userId }), {
    includePrivate: true,
  });
}

export async function updateOwnGuideProfile(userId, updates) {
  return getGuideResponse(
    GuideProfile.findOneAndUpdate(
      { user: userId },
      { $set: updates },
      { new: true, runValidators: true },
    ),
    { includePrivate: true },
  );
}
