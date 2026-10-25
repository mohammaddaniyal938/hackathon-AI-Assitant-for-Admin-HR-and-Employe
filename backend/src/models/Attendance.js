import mongoose from "mongoose";

const correctionSchema = new mongoose.Schema({
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  requestedCheckIn: { type: Date, default: null },
  requestedCheckOut: { type: Date, default: null },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  reviewComment: { type: String, trim: true, maxlength: 1000, default: "" },
}, { timestamps: true });

const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  workDate: { type: String, required: true },
  checkIn: { type: Date, default: null },
  checkOut: { type: Date, default: null },
  status: { type: String, enum: ["present", "late", "half-day", "absent", "on-leave"], default: "present" },
  corrections: { type: [correctionSchema], default: [] },
}, { timestamps: true });

attendanceSchema.index({ employee: 1, workDate: 1 }, { unique: true });

export default mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
