import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: [
        "attendance_dispute",
        "potential_guide_no_show",
        "refund_review",
        "safety",
      ],
      required: true,
    },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    occurrence: { type: mongoose.Schema.Types.ObjectId, ref: "Occurrence" },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    report: { type: String, maxlength: 4000, required: true },
    resolution: { type: String, maxlength: 4000 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: Date,
  },
  { timestamps: true, optimisticConcurrency: true },
);
export const OperationalCase = mongoose.model("OperationalCase", schema);
