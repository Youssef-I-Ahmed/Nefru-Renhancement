import {Trip} from '../models/trip.model.js';
import {TripRevision} from '../models/tripRevision.model.js';
import {GuideProfile} from '../models/guide.model.js';
import {TouristProfile} from '../models/tourist.model.js';
import {Booking} from '../models/booking.model.js';
import { cloudinary, isCloudinaryConfigured } from "../config/cloudinary.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

function requireCloudinary() {
  if (!isCloudinaryConfigured()) {
    throw new AppError(
      "Cloudinary is not configured. Add CLOUDINARY_URL to the backend environment.",
      503,
      "CLOUDINARY_NOT_CONFIGURED",
    );
  }
}

export function uploadImageBuffer(
  buffer,
  { folder = "media", publicId, transformation } = {},
) {
  requireCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.cloudinaryFolder}/${folder}`,
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: "image",
        transformation,
      },
      (error, result) => {
        // if (error) {
        //   reject(error);
        //   return;
        // }
        if (error) {
          console.error("CLOUDINARY UPLOAD ERROR:", {
            message: error.message,
            http_code: error.http_code,
            name: error.name,
          });

          reject(error);
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );

    stream.end(buffer);
  });
}

export async function destroyImage(publicId) {
  if (!publicId || !isCloudinaryConfigured()) return;
  const refs=await Promise.all([Trip.exists({$or:[{imagePublicId:publicId},{galleryPublicIds:publicId}]}),TripRevision.exists({$or:[{'content.imagePublicId':publicId},{'content.galleryPublicIds':publicId}]}),GuideProfile.exists({$or:[{avatarPublicId:publicId},{'gallery.publicId':publicId}]}),TouristProfile.exists({avatarPublicId:publicId})]);
  if(refs.some(Boolean))return;
  const snapshots=await Booking.find({'tripSnapshot.image':{$exists:true}}).select('tripSnapshot.image').lean();
  if(snapshots.some(b=>b.tripSnapshot.image?.includes(publicId)))return;
  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
}
