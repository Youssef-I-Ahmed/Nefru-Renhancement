import mongoose from "mongoose";

const BOOKING_STATUSES = [
  "pending_payment",
  "confirmed",
  "completed",
  "cancelled",
  "expired",
  "refunded",
  "no_show",
];

const PAYMENT_STATUSES = [
  "unpaid",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
];

const bookingSchema = new mongoose.Schema(
  {
    occurrence:{type:mongoose.Schema.Types.ObjectId,ref:'Occurrence',index:true},
    tripSnapshot:{type:Object,default:null}, policySnapshot:{type:Object,default:null}, publishedVersion:Number,
    platformCommissionBps:{type:Number,min:0,max:10000,default:0}, earningsAvailableAt:Date,
    settlementStatus:{type:String,enum:['unsettled','settled'],default:'unsettled'}, settledAt:Date,
    refundEntitlement:{type:String,enum:['not_applicable','full_refund_due','admin_review'],default:'not_applicable'},
    attendance:{status:{type:String,enum:['booked','checked_in','no_show','attendance_disputed'],default:'booked'},markedAt:Date,markedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}},
    trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    tourist: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    guide: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    occurrenceKey: { type: String, required: true, trim: true, index: true },
    slotDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    date: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    timeSlot: { type: String, required: true, trim: true, maxlength: 50 },
    numberOfGuests: { type: Number, required: true, min: 1, max: 1, default: 1 },
    pricePerPerson: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    platformFee: { type: Number, required: true, min: 0, default: 0 },
    guideEarnings: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, enum: ["EGP", "USD"], default: "EGP" },
    status: { type: String, enum: BOOKING_STATUSES, default: "pending_payment", index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid", index: true },
    paymentProvider: { type: String, enum: ["paymob", "none"], default: "none", index: true },
    paymentMethod: {
      type: String,
      enum: ["card", "wallet", "kiosk", "bank", "paymob", "none"],
      default: "none",
    },
    paymentReference: { type: String, trim: true, default: "" },
    paymentFailureReason: { type: String, trim: true, maxlength: 500, default: "" },
    paymentAttemptCount: { type: Number, min: 0, default: 0 },
    lastPaymentAttemptAt: { type: Date, default: null },
    lastPaymentSyncAt: { type: Date, default: null },

    // Paymob references. Client secret is intentionally hidden from ordinary reads.
    paymobIntentionId: { type: String, trim: true, default: "", index: true },
    paymobOrderId: { type: String, trim: true, default: "", index: true },
    paymobTransactionId: { type: String, trim: true, default: "", index: true },
    paymobClientSecret: { type: String, trim: true, default: "", select: false },

    // Display-only FX snapshot. EGP remains the charged/accounting currency.
    displayCurrency: {
      type: String,
      enum: ["EGP", "USD", "EUR", "GBP"],
      default: "EGP",
    },
    displayAmount: { type: Number, min: 0, default: null },
    displayFxRate: { type: Number, min: 0, default: null },
    fxRateUpdatedAt: { type: Date, default: null },

    // Deprecated compatibility field for historical Stripe bookings. New payments
    // must not write to it.
    stripePaymentIntentId: { type: String, trim: true, default: "", index: true },

    specialRequests: { type: [String], default: [] },
    bookingSource: { type: String, enum: ["web", "mobile", "admin", "seed"], default: "web" },
    holdExpiresAt: { type: Date, default: null, index: true },
    cancellationReason: { type: String, trim: true, maxlength: 500, default: "" },
    cancelledBy: { type: String, enum: ["tourist", "guide", "admin", "system", ""], default: "" },
    cancelledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, optimisticConcurrency:true },
);

bookingSchema.index({ trip: 1, occurrenceKey: 1, status: 1 });
bookingSchema.index({ tourist: 1, createdAt: -1 });
bookingSchema.index({ guide: 1, date: 1 });
bookingSchema.index({ status: 1, holdExpiresAt: 1 });

export const Booking = mongoose.model("Booking", bookingSchema);
export { BOOKING_STATUSES, PAYMENT_STATUSES };
