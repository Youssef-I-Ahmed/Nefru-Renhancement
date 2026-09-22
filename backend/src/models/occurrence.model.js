import mongoose from "mongoose";
import { OCCURRENCES } from "../domain/policies.js";
const schema = new mongoose.Schema(
  {
    trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
    guide: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    occurrenceKey: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    capacity: { type: Number, min: 1, required: true },
    status: { type: String, enum: OCCURRENCES, default: "upcoming" },
    publishedVersion: { type: Number, default: 1 },
    bookingFence: { type: Number, default: 0 },
    actualStartedAt: Date,
    actualEndedAt: Date,
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    completionSource: String,
  },
  { timestamps: true, optimisticConcurrency: true },
);
schema.index({ trip: 1, occurrenceKey: 1 }, { unique: true });
schema.index({ status: 1, endsAt: 1 });
export const Occurrence = mongoose.model("Occurrence", schema);
