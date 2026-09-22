import mongoose from "mongoose";

const fxRateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "tourist-display" },
    baseCurrency: { type: String, required: true, default: "EGP" },
    rates: { type: Map, of: Number, default: {} },
    provider: { type: String, trim: true, default: "frankfurter-cbe" },
    sourceDate: { type: String, trim: true, default: "" },
    sourceUpdatedAt: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

export const FxRate = mongoose.model("FxRate", fxRateSchema);
