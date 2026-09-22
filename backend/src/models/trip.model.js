import mongoose from "mongoose";

const highlightSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 50 },
    text: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false },
);

const reviewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    date: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    avatar: { type: String, default: "" },
    rating: { type: Number, min: 1, max: 5, default: 5 },
  },
  { _id: false, timestamps: true },
);


const moderationHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["submitted", "published", "changes_requested", "rejected", "hidden"],
      required: true,
    },
    reason: { type: String, trim: true, maxlength: 1000, default: "" },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);


const moderationSchema = new mongoose.Schema(
  {
    lastAction: {
      type: String,
      enum: ["", "submitted", "published", "changes_requested", "rejected", "hidden"],
      default: "",
    },
    reason: { type: String, trim: true, maxlength: 1000, default: "" },
    reviewedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    history: { type: [moderationHistorySchema], default: [] },
  },
  { _id: false },
);

const tripSchema = new mongoose.Schema(
  {
    lifecycleStatus: {type:String,enum:['draft','live','paused_by_guide','hidden_by_admin','archived'],index:true},
    reviewStatus: {type:String,enum:['not_submitted','in_review','changes_requested','approved','rejected'],index:true},
    publishedVersion: {type:Number,default:0},
    bookingFence: {type:Number,default:0},
    licenseRequired: {type:Boolean,default:false},
    identityVerificationRequired: {type:Boolean,default:false},
    featured: {type:Boolean,default:false}, featuredFrom:Date, featuredUntil:Date,
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    longDescription: { type: String, trim: true, default: "" },
    location: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    price: { type: Number, required: true },
    currency: { type: String, enum: ["EGP", "USD"], default: "EGP" },
    duration: { type: String, required: true },
    image: { type: String, default: "" },
    imagePublicId: { type: String, default: "", select: false },
    guide: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      enum: ["History", "Adventure", "Culture", "Food"],
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "reviewing", "active", "pending", "approved", "rejected"],
      default: "draft",
    },
    groupSize: { type: Number, min: 1, default: 12 },
    schedule: {
      type: Object,
      default: { dates: [], slots: [] },
    },
    gallery: { type: [String], default: [] },
    galleryPublicIds: { type: [String], default: [], select: false },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewsCount: { type: Number, min: 0, default: 0 },
    highlights: { type: [highlightSchema], default: [] },
    reviews: { type: [reviewSchema], default: [] },
    moderation: {
      type: moderationSchema,
      default: () => ({}),
      select: false,
    },
  },
  { timestamps: true, optimisticConcurrency:true },
);

export const Trip = mongoose.model("Trip", tripSchema);
