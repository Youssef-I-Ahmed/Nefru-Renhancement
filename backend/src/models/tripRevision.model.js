import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
    guide: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    baseVersion: { type: Number, required: true },
    content: { type: Object, required: true },
    reviewStatus: {
      type: String,
      enum: ["draft", "in_review", "changes_requested", "approved", "rejected"],
      default: "draft",
    },
    open: { type: Boolean, default: true },
    reason: { type: String, default: "", maxlength: 1000 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
  },
  { timestamps: true, optimisticConcurrency: true },
);
schema.index(
  { trip: 1 },
  { unique: true, partialFilterExpression: { open: true } },
);
export const TripRevision = mongoose.model("TripRevision", schema);
