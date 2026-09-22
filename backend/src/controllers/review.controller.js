import {submitExperienceReview,editReview} from '../services/reviewLifecycle.service.js';
import {reviewEligible} from '../domain/policies.js';
import mongoose from "mongoose";

import { Booking } from "../models/booking.model.js";
import { GuideProfile } from "../models/guide.model.js";
import { Notification } from "../models/notification.model.js";
import { Review } from "../models/review.model.js";
import { TouristProfile } from "../models/tourist.model.js";
import { Trip } from "../models/trip.model.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function assertObjectId(value, label = "ID") {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`Invalid ${label}`, 400, "INVALID_ID");
  }
}

function cleanReviewInput(body = {}) {
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError("Rating must be a whole number from 1 to 5", 400, "INVALID_RATING");
  }

  const comment = String(body.comment || "").trim();
  if (comment.length < 10) {
    throw new AppError("Review must be at least 10 characters", 400, "REVIEW_TOO_SHORT");
  }
  if (comment.length > 1500) {
    throw new AppError("Review cannot exceed 1500 characters", 400, "REVIEW_TOO_LONG");
  }

  return {
    rating,
    title: String(body.title || "").trim().slice(0, 120),
    comment,
    language: String(body.language || "en").trim().toLowerCase().slice(0, 20) || "en",
  };
}

async function getTravelerProfiles(userIds) {
  const profiles = await TouristProfile.find({ user: { $in: userIds } })
    .select("user fullName avatar")
    .lean();
  return new Map(profiles.map((profile) => [profile.user.toString(), profile]));
}

async function getGuideProfiles(userIds) {
  const profiles = await GuideProfile.find({ user: { $in: userIds } })
    .select("user fullName avatar verificationStatus")
    .lean();
  return new Map(profiles.map((profile) => [profile.user.toString(), profile]));
}

function serializeReview(review, travelers, guides) {
  const touristId = (review.tourist?._id || review.tourist)?.toString?.() || "";
  const guideId = (review.guide?._id || review.guide)?.toString?.() || "";
  const trip = review.trip || {};
  const traveler = travelers.get(touristId);
  const guide = guides.get(guideId);

  return {
    id: review._id,
    bookingId: review.booking?._id || review.booking,
    tripId: trip._id || review.trip,
    tripTitle: trip.title || "Experience",
    tripImage: trip.image || "",
    tripLocation: trip.location || "",
    guideId,
    guideName: guide?.fullName || "Local guide",
    guideVerified: guide?.verificationStatus === "approved",
    travelerName: traveler?.fullName?.split(" ")[0] || "NEFRU traveler",
    travelerAvatar: traveler?.avatar || "",
    rating: review.rating,
    title: review.title || "",
    comment: review.comment,
    language: review.language,
    isVerifiedBooking: review.isVerifiedBooking === true,
    moderationStatus:review.moderationStatus,
    guideResponse: review.guideResponse || "",
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}







export const getMyReviews = asyncHandler(async (req, res) => {
  const [reviews, completedBookings] = await Promise.all([
    Review.find({ tourist: req.user._id })
      .populate("trip", "title image location")
      .sort({ createdAt: -1 })
      .lean(),
    Booking.find({ tourist: req.user._id, status: "completed", paymentStatus:"paid", "attendance.status":"checked_in" }).populate("occurrence")
      .populate("trip", "title image location")
      .sort({ completedAt: -1, date: -1 })
      .lean(),
  ]);

  const reviewedBookingIds = new Set(reviews.map((review) => review.booking.toString()));
  const guideIds = [...new Set([
    ...reviews.map((review) => (review.guide?._id || review.guide)?.toString?.()),
    ...completedBookings.map((booking) => (booking.guide?._id || booking.guide)?.toString?.()),
  ].filter(Boolean))];
  const touristIds = [...new Set(reviews.map((review) => (review.tourist?._id || review.tourist)?.toString?.()).filter(Boolean))];

  const [guides, travelers] = await Promise.all([
    getGuideProfiles(guideIds),
    getTravelerProfiles(touristIds),
  ]);

  const serialized = reviews.map((review) => serializeReview(review, travelers, guides));
  const eligibleBookings = completedBookings
    .filter((booking) => !reviewedBookingIds.has(booking._id.toString()) && reviewEligible(booking,booking.occurrence))
    .map((booking) => {
      const guideId = (booking.guide?._id || booking.guide)?.toString?.() || "";
      return {
        bookingId: booking._id,
        tripId: booking.trip?._id || booking.trip,
        title: booking.trip?.title || "Experience",
        image: booking.trip?.image || "",
        location: booking.trip?.location || "",
        guideName: guides.get(guideId)?.fullName || "Local guide",
        completedAt: booking.completedAt || booking.endAt || booking.date,
      };
    });

  res.status(200).json({
    success: true,
    data: { reviews: serialized, eligibleBookings },
  });
});

export const getTripReviews = asyncHandler(async (req, res) => {
  assertObjectId(req.params.tripId, "trip ID");
  const reviews = await Review.find({ trip: req.params.tripId, isVisible: true, moderationStatus:"published" })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const touristIds = [...new Set(reviews.map((review) => review.tourist.toString()))];
  const guideIds = [...new Set(reviews.map((review) => review.guide.toString()))];
  const [travelers, guides] = await Promise.all([
    getTravelerProfiles(touristIds),
    getGuideProfiles(guideIds),
  ]);
  res.status(200).json({
    success: true,
    data: { reviews: reviews.map((review) => {const row=serializeReview(review,travelers,guides);delete row.bookingId;return row;}) },
  });
});

export const createReview=asyncHandler(async(req,res)=>{assertObjectId(req.body.bookingId);const review=await submitExperienceReview(req.user,req.body.bookingId,cleanReviewInput(req.body),req.body.survey);res.status(201).json({success:true,message:'Review submitted for moderation',data:{review}});});

export const updateReview=asyncHandler(async(req,res)=>{assertObjectId(req.params.id);const review=await editReview(req.params.id,req.user,cleanReviewInput(req.body));res.json({success:true,data:{review},message:'Review resubmitted for moderation'});});

export const deleteReview=asyncHandler(async(req,res)=>{assertObjectId(req.params.id);await editReview(req.params.id,req.user,{},true);res.json({success:true,message:'Review withdrawn; history preserved'});});
