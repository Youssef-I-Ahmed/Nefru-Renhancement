import {editTrip as saveTripContent} from '../services/marketplace.service.js';
import {TripRevision} from '../models/tripRevision.model.js';
import mongoose from "mongoose";
import { Router } from "express";

import {
  getAllTrips,
  createTrip,
  getTripById,
  updateMyTrip,
  updateTripMedia,
} from "../controllers/trip.controller.js";
import {
  changeTripStatusV2,
  getMyGuideTripsV2,
} from "../controllers/guideTripManagement.controller.js";
import { upload } from "../config/upload.js";
import { protect, requireApprovedGuide } from "../middlewares/authMiddleware.js";
import { Trip } from "../models/trip.model.js";
import { destroyImage, uploadImageBuffer } from "../services/media.service.js";

const tripRouter = Router();

function restrictGuideTripStatus(req, res, next) {
  if (req.user?.role === "guide" && !["draft", "reviewing"].includes(req.body?.status)) {
    return res.status(403).json({
      success: false,
      message: "Guides can save drafts or submit tours for review. Publishing is controlled by the admin review flow.",
    });
  }

  return next();
}

tripRouter.get("/guide/me", protect, getMyGuideTripsV2);
tripRouter
  .route("/")
  .get(getAllTrips)
  .post(protect, requireApprovedGuide, createTrip);
tripRouter
  .route("/:id")
  .get(getTripById)
  .patch(protect, requireApprovedGuide, updateMyTrip);
tripRouter.patch(
  "/:id/status",
  protect,
  requireApprovedGuide,
  restrictGuideTripStatus,
  changeTripStatusV2,
);
tripRouter.patch("/:id/media", protect, requireApprovedGuide, updateTripMedia);

tripRouter.post(
  "/:id/upload-media",
  protect,
  requireApprovedGuide,
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 6 },
  ]),
  async (req, res, next) => {
    const newlyUploaded = [];

    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid trip ID" });
      }

      const trip = await Trip.findById(req.params.id).select(
        "+imagePublicId +galleryPublicIds",
      );
      if (!trip) {
        return res.status(404).json({ success: false, message: "Trip not found" });
      }
      if (
        req.user.role !== "admin" &&
        trip.guide?.toString() !== req.user._id?.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only upload media for your own tours",
        });
      }

      const pendingRevision=await TripRevision.findOne({trip:trip._id,open:true}).lean();
      if(pendingRevision)Object.assign(trip,pendingRevision.content);
      const files = req.files || {};
      const coverImage = files.coverImage?.[0];
      const galleryImages = files.galleryImages || [];
      let galleryIndexes = [];

      try {
        galleryIndexes = JSON.parse(req.body.galleryIndexes || "[]");
      } catch {
        galleryIndexes = [];
      }
      if (!Array.isArray(galleryIndexes) || galleryIndexes.length !== galleryImages.length) {
        galleryIndexes = galleryImages.map((_, index) => index);
      }

      const nextGallery = [...(trip.gallery || [])].slice(0, 6);
      const nextPublicIds = [...(trip.galleryPublicIds || [])].slice(0, 6);
      const replacedPublicIds = [];

      if (coverImage?.buffer) {
        const uploadedCover = await uploadImageBuffer(coverImage.buffer, {
          folder: "tours/covers",
          publicId: `${trip._id}-cover-${Date.now()}`,
          transformation: [{ width: 1920, height: 1080, crop: "limit", quality: "auto" }],
        });
        newlyUploaded.push(uploadedCover.publicId);
        if (trip.imagePublicId) replacedPublicIds.push(trip.imagePublicId);
        trip.image = uploadedCover.url;
        trip.imagePublicId = uploadedCover.publicId;
      }

      for (let uploadIndex = 0; uploadIndex < galleryImages.length; uploadIndex += 1) {
        const file = galleryImages[uploadIndex];
        const slotIndex = Math.max(0, Math.min(Number(galleryIndexes[uploadIndex]) || 0, 5));
        const uploaded = await uploadImageBuffer(file.buffer, {
          folder: "tours/gallery",
          publicId: `${trip._id}-gallery-${slotIndex}-${Date.now()}-${uploadIndex}`,
          transformation: [{ width: 1800, height: 1200, crop: "limit", quality: "auto" }],
        });
        newlyUploaded.push(uploaded.publicId);
        if (nextPublicIds[slotIndex]) replacedPublicIds.push(nextPublicIds[slotIndex]);
        nextGallery[slotIndex] = uploaded.url;
        nextPublicIds[slotIndex] = uploaded.publicId;
      }

      const compactGallery = nextGallery
        .map((url, index) => ({ url, publicId: nextPublicIds[index] || "" }))
        .filter((item) => Boolean(item.url));
      trip.gallery = compactGallery.map((item) => item.url);
      trip.galleryPublicIds = compactGallery.map((item) => item.publicId);
      await saveTripContent(trip._id,{image:trip.image,imagePublicId:trip.imagePublicId,gallery:trip.gallery,galleryPublicIds:trip.galleryPublicIds},req.user);

      await Promise.allSettled(
        [...new Set(replacedPublicIds)].map((publicId) => destroyImage(publicId)),
      );

      return res.status(200).json({
        success: true,
        message: "Images uploaded to Cloudinary successfully",
        data: {
          image: trip.image,
          gallery: trip.gallery,
        },
      });
    } catch (error) {
      await Promise.allSettled(newlyUploaded.map((publicId) => destroyImage(publicId)));
      next(error);
    }
  },
);

export default tripRouter;
