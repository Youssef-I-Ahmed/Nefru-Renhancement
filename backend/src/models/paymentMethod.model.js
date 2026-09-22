import mongoose from "mongoose";

const paymentMethodSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["paymob"],
      default: "paymob",
      required: true,
      index: true,
    },
    paymobTokenId: {
      type: String,
      trim: true,
      required: true,
    },
    tokenCiphertext: {
      type: String,
      required: true,
      select: false,
    },
    tokenIv: {
      type: String,
      required: true,
      select: false,
    },
    tokenAuthTag: {
      type: String,
      required: true,
      select: false,
    },
    maskedPan: {
      type: String,
      trim: true,
      default: "",
    },
    brand: {
      type: String,
      trim: true,
      default: "Card",
    },
    expiryMonth: {
      type: String,
      trim: true,
      default: "",
    },
    expiryYear: {
      type: String,
      trim: true,
      default: "",
    },
    cardholderName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    providerOrderId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

paymentMethodSchema.index(
  { user: 1, provider: 1, paymobTokenId: 1 },
  { unique: true },
);
paymentMethodSchema.index({ user: 1, provider: 1, isActive: 1, createdAt: -1 });

export const PaymentMethod = mongoose.model("PaymentMethod", paymentMethodSchema);
