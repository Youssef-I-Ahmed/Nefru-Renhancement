import mongoose from "mongoose";

const GUIDE_SPECIALTIES = [
  "History & Culture",
  "Food & Culinary",
  "Adventure",
  "Luxury",
  "Nile Cruise",
  "Desert Safari",
];

const galleryItemSchema = new mongoose.Schema(
  {
    src: { type: String, required: true, trim: true },
    alt: { type: String, trim: true, maxlength: 150, default: "" },
    publicId: { type: String, trim: true, default: "", select: false },
  },
  { timestamps: true },
);

const guideProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    identityStatus:{type:String,enum:['pending','approved','expiring_soon','expired','renewal_in_review','rejected']}, identityExpiresAt:Date,
    licenseStatus:{type:String,enum:['pending','approved','expiring_soon','expired','renewal_in_review','rejected'],default:'pending'}, licenseExpiresAt:Date,
    internalQualityScore:{type:Number,select:false}, featured:{type:Boolean,default:false}, featuredFrom:Date,featuredUntil:Date,
    fullName: { type: String, required: true },
    verificationStatus: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
      select: false,
    },
    headline: { type: String, trim: true, maxlength: 120, default: "" },
    location: { type: String, trim: true, maxlength: 100, default: "" },
    phoneNumber: { type: String, trim: true, maxlength: 30, default: "" },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    nationality: { type: String, trim: true, maxlength: 80, default: "" },
    dateOfBirth: { type: Date, default: null },
    preferredLanguage: { type: String, trim: true, maxlength: 20, default: "en" },
    about: { type: String, trim: true, maxlength: 2000, default: "" },
    yearsExperience: { type: Number, min: 0, max: 60, default: 0 },
    languages: { type: [String], default: [] },
    specialties: { type: [String], enum: GUIDE_SPECIALTIES, default: [] },
    avatar: { type: String, trim: true, default: "" },
    avatarPublicId: { type: String, trim: true, default: "", select: false },
    gallery: { type: [galleryItemSchema], default: [] },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewsCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

const GuideProfile = mongoose.model("GuideProfile", guideProfileSchema);

export { GuideProfile, GUIDE_SPECIALTIES };
