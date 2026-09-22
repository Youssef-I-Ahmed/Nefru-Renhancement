import { publicTrips } from '../services/catalog.service.js';
import { editTrip as safeEditTrip, legacyTripStatus as safeTripStatus } from './marketplace.controller.js';
import { Trip } from "../models/trip.model.js";
import { GuideProfile } from "../models/guide.model.js";
import { Booking } from "../models/booking.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { normalizeTripSchedule } from "../utils/tripSchedule.js";

const ALLOWED_STATUSES = ["draft", "reviewing", "active"];
const BASE_CURRENCY = "EGP";

function getTripSummary(trip) {
  return {
    id: trip._id,
    title: trip.title,
    description: trip.description,
    longDescription: trip.longDescription || trip.description,
    location: trip.location,
    coordinates: trip.coordinates,
    price: trip.price,
    currency: trip.currency || BASE_CURRENCY,
    duration: trip.duration,
    image: trip.image,
    category: trip.category,
    status: trip.status || "draft",
    statusText:
      trip.status === "reviewing"
        ? "Reviewing"
        : trip.status === "active"
          ? "Active"
          : "Draft",
    groupSize: trip.groupSize || 12,
    actionLabel: trip.status === "draft" ? "Continue" : "Manage",
    highlights: trip.highlights || [],
    reviews: trip.reviews || [],
    gallery: trip.gallery || [],
    schedule: normalizeTripSchedule(trip.schedule, trip.groupSize || 1),
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

function canManageTrip(user, trip) {
  if (!user || !trip) return false;
  if (user.role === "admin") return true;
  return trip.guide?.toString() === user._id?.toString();
}

/**
 * @desc Get all trips with search and filter capabilities
 * @route GET /api/trips
 * @access Public
 */
export const getAllTrips=asyncHandler(async(req,res)=>{const rows=await publicTrips();const matches=rows.filter(t=>(!req.query.search||(t.title+' '+t.description).toLowerCase().includes(String(req.query.search).toLowerCase()))&&(!req.query.category||t.category===req.query.category)&&(!req.query.location||t.location.toLowerCase().includes(String(req.query.location).toLowerCase())));res.json({success:true,count:matches.length,data:matches});});

/**
 * @desc Get a single trip by ID with full details including guide info
 * @route GET /api/trips/:id
 * @access Public
 */
export const getTripById=asyncHandler(async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id)){res.status(400);throw new Error('Invalid trip ID');}const [trip]=await publicTrips({_id:req.params.id});if(!trip){res.status(404);throw new Error('Trip not found');}res.json({success:true,data:trip});});

/**
 * @desc Create a new trip
 * @route POST /api/trips
 * @access Private (GuideProfile/Admin)
 */
export const createTrip = asyncHandler(async (req, res) => {
  if (req.user.role !== "guide" && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Only guides and admins can create tours");
  }

  const {
    title,
    description,
    longDescription,
    location,
    coordinates,
    price,
    duration,
    image,
    category,
    groupSize,
    schedule,
    gallery,
  } = req.body;

  const invalid =
    !title ||
    !description ||
    !location ||
    !price ||
    !duration ||
    !category;

  if (invalid) {
    res.status(400);
    throw new Error(
      "Please provide title, description, location, price, duration and category"
    );
  }

  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    res.status(400);
    throw new Error("Price must be a positive EGP amount");
  }

  const resolvedCoordinates =
    Number.isFinite(Number(coordinates?.lat)) && Number.isFinite(Number(coordinates?.lng))
      ? { lat: Number(coordinates.lat), lng: Number(coordinates.lng) }
      : { lat: 30.0444, lng: 31.2357 };

  const trip = await Trip.create({
    title,
    description,
    longDescription: longDescription || description,
    location,
    coordinates: resolvedCoordinates,
    price: numericPrice,
    currency: BASE_CURRENCY,
    duration,
    image: image || "",
    category,
    groupSize: groupSize || 12,
    schedule: schedule || { dates: [], slots: [] },
    gallery: Array.isArray(gallery) ? gallery : [],
    guide: req.user._id,
    status: "draft", lifecycleStatus: "draft", reviewStatus: "not_submitted",
  });

  res.status(201).json({
    success: true,
    message: "Trip created successfully",
    data: getTripSummary(trip),
  });
});
/**
 * @desc Get tours for the logged-in guide
 * @route GET /api/trips/guide/me
 * @access Private (GuideProfile)
 */
export const getMyGuideTrips = asyncHandler(async (req, res) => {
  if (req.user.role !== "guide" && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Only guides can view their tours");
  }

  const { status } = req.query;
  const query = { guide: req.user._id };

  if (status && ALLOWED_STATUSES.includes(status)) {
    query.status = status;
  }

  const trips = await Trip.find(query).sort({ createdAt: -1 }).lean();

  const counts = {
    all: await Trip.countDocuments({ guide: req.user._id }),
    active: await Trip.countDocuments({ guide: req.user._id, status: "active" }),
    reviewing: await Trip.countDocuments({ guide: req.user._id, status: "reviewing" }),
    draft: await Trip.countDocuments({ guide: req.user._id, status: "draft" }),
  };

  res.status(200).json({
    success: true,
    data: {
      tours: trips.map(getTripSummary),
      counts,
    },
  });
});

/**
 * @desc Update a guide tour
 * @route PATCH /api/trips/:id
 * @access Private (GuideProfile/Admin)
 */
export const updateMyTrip = safeEditTrip;

/**
 * @desc Change trip review status
 * @route PATCH /api/trips/:id/status
 * @access Private (GuideProfile/Admin)
 */
export const changeTripStatus = safeTripStatus;

/**
 * @desc Update tour media fields
 * @route PATCH /api/trips/:id/media
 * @access Private (GuideProfile/Admin)
 */
export const updateTripMedia = safeEditTrip;
