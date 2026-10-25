import mongoose from "mongoose";

const payrollEntrySchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  employeeCode: { type: String, required: true },
  employeeName: { type: String, required: true },
  basicSalary: { type: Number, required: true },
  hra: { type: Number, required: true },
  medicalAllowance: { type: Number, required: true },
  grossSalary: { type: Number, required: true },
  absentDays: { type: Number, default: 0 },
  halfDays: { type: Number, default: 0 },
  unpaidLeaveDays: { type: Number, default: 0 },
  deductions: { type: Number, required: true },
  netSalary: { type: Number, required: true },
}, { _id: false });

const payrollRunSchema = new mongoose.Schema({
  period: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  status: { type: String, enum: ["draft", "reviewed", "finalized", "locked"], default: "draft", index: true },
  entries: { type: [payrollEntrySchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  finalizedAt: { type: Date, default: null },
  totalGross: { type: Number, default: 0 },
  totalNet: { type: Number, default: 0 },
}, { timestamps: true });

payrollRunSchema.index({ period: 1 }, { unique: true });

export default mongoose.models.PayrollRun || mongoose.model("PayrollRun", payrollRunSchema);
