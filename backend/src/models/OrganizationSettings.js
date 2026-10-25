import mongoose from "mongoose";

const organizationSettingsSchema = new mongoose.Schema({
  key: { type: String, default: "default", unique: true },
  organizationName: { type: String, default: "HCM Lite Company", trim: true },
  timezone: { type: String, default: "UTC" },
  officeStart: { type: String, default: "09:00" },
  gracePeriodMinutes: { type: Number, default: 15, min: 0, max: 240 },
  weekendDays: { type: [Number], default: [0, 6] },
  holidays: { type: [Date], default: [] },
  departments: { type: [String], default: [] },
  designations: { type: [String], default: [] },
  leaveQuotas: {
    annual: { type: Number, default: 14 },
    sick: { type: Number, default: 8 },
    casual: { type: Number, default: 10 },
  },
  payroll: {
    hraRate: { type: Number, default: 0.4, min: 0 },
    medicalRate: { type: Number, default: 0.1, min: 0 },
    grossMultiplier: { type: Number, default: 1.5, min: 0 },
  },
}, { timestamps: true });

export default mongoose.models.OrganizationSettings || mongoose.model("OrganizationSettings", organizationSettingsSchema);
