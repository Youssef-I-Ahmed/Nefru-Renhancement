import mongoose from "mongoose";
const rating = { type: Number, min: 1, max: 5 };
const schema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },
    tourist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    guide: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    overall: rating,
    knowledge: rating,
    communication: rating,
    punctuality: rating,
    safety: rating,
    value: rating,
    matchedListing: rating,
    wouldRecommend: Boolean,
    hadProblem: Boolean,
    privateFeedback: { type: String, maxlength: 4000, default: "" },
  },
  { timestamps: true },
);
export const PrivateExperienceSurvey = mongoose.model(
  "PrivateExperienceSurvey",
  schema,
);
