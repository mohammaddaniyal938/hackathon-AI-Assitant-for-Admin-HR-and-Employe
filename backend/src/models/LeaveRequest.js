import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  leaveType: { type: String, enum: ["annual", "sick", "casual", "unpaid"], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  workingDays: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending", index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  reviewComment: { type: String, trim: true, maxlength: 1000, default: "" },
}, { timestamps: true });

export default mongoose.models.LeaveRequest || mongoose.model("LeaveRequest", leaveRequestSchema);
