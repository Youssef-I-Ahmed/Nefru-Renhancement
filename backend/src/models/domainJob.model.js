import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ["notification", "email", "review_invitation", "ratings"],
      required: true,
    },
    payload: { type: Object, required: true },
    dueAt: { type: Date, default: Date.now },
    lockedUntil: Date,
    attempts: { type: Number, default: 0 },
    completedAt: Date,
    lastError: { type: String, default: "" },
  },
  { timestamps: true },
);
schema.index({ completedAt: 1, dueAt: 1, lockedUntil: 1 });
export const DomainJob = mongoose.model("DomainJob", schema);
