import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    orderId: { type: String, index: true },
    intentionId: String,
    transactionId: { type: String, unique: true, sparse: true },
    outcome: {
      type: String,
      enum: ["created", "failed", "paid", "refunded"],
      required: true,
    },
    amountCents: { type: Number, required: true },
    currency: { type: String, enum: ["EGP"], required: true },
  },
  { timestamps: true },
);
export const PaymentAttempt = mongoose.model("PaymentAttempt", schema);
