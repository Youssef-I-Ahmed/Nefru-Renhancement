import mongoose from "mongoose";
const schema = new mongoose.Schema({
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  performedByRole: { type: String, required: true },
  reason: { type: String, maxlength: 1000, default: "" },
  before: { type: Object, default: {} },
  after: { type: Object, default: {} },
  timestamp: { type: Date, default: Date.now },
});
schema.index({ entityType: 1, entityId: 1, timestamp: -1 });
export const AuditLog = mongoose.model("AuditLog", schema);
