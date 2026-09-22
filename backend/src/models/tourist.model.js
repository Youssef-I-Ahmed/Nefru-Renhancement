import mongoose from "mongoose";

const touristProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    avatarPublicId: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    nationality: {
      type: String,
      trim: true,
      default: "",
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    preferredLanguage: {
      type: String,
      trim: true,
      maxlength: 20,
      default: "en",
    },
    preferredCurrency: {
      type: String,
      enum: ["EGP", "USD", "EUR", "GBP"],
      default: "EGP",
    },
    savedTrips: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Trip" }],
      default: [],
    },
  },
  { timestamps: true },
);

const TouristProfile = mongoose.model("TouristProfile", touristProfileSchema);

export { TouristProfile };
