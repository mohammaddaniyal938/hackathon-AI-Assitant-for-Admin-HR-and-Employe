import OrganizationSettings from "../models/OrganizationSettings.js";
import AuditLog from "../models/AuditLog.js";

const getOrCreateSettings = async () => {
  let settings = await OrganizationSettings.findOne({ key: "default" });
  if (!settings) settings = await OrganizationSettings.create({ key: "default" });
  return settings;
};

export const getOrganizationSettings = async (_req, res) => {
  try {
    res.json({ settings: await getOrCreateSettings() });
  } catch (error) {
    console.error("Organization settings lookup failed", error);
    res.status(500).json({ message: "Unable to load organization settings" });
  }
};

export const updateOrganizationSettings = async (req, res) => {
  try {
    const allowed = ["organizationName", "timezone", "officeStart", "gracePeriodMinutes", "weekendDays", "holidays", "departments", "designations", "leaveQuotas", "payroll"];
    const updates = Object.fromEntries(allowed.filter((field) => Object.hasOwn(req.body || {}, field)).map((field) => [field, req.body[field]]));
    if (!Object.keys(updates).length) return res.status(400).json({ message: "No supported settings provided" });
    if (updates.officeStart !== undefined && (typeof updates.officeStart !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(updates.officeStart))) {
      return res.status(400).json({ message: "Office start must use HH:mm (24-hour time)" });
    }
    if (updates.gracePeriodMinutes !== undefined && (!Number.isInteger(updates.gracePeriodMinutes) || updates.gracePeriodMinutes < 0 || updates.gracePeriodMinutes > 240)) {
      return res.status(400).json({ message: "Grace period must be between 0 and 240 minutes" });
    }
    if (updates.organizationName !== undefined && (typeof updates.organizationName !== "string" || !updates.organizationName.trim() || updates.organizationName.length > 120)) {
      return res.status(400).json({ message: "Organization name must be between 1 and 120 characters" });
    }
    if (updates.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: updates.timezone });
      } catch {
        return res.status(400).json({ message: "Enter a valid IANA timezone" });
      }
    }
    if (updates.weekendDays && (!Array.isArray(updates.weekendDays) || updates.weekendDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) {
      return res.status(400).json({ message: "Weekend days must be a list of weekdays from 0 to 6" });
    }
    if (updates.holidays !== undefined && (!Array.isArray(updates.holidays) || updates.holidays.some((date) => typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime()) || new Date(date).toISOString().slice(0, 10) !== date))) {
      return res.status(400).json({ message: "Public holidays must be a list of valid dates" });
    }
    for (const field of ["departments", "designations"]) {
      if (updates[field] !== undefined && (!Array.isArray(updates[field]) || updates[field].some((value) => typeof value !== "string" || !value.trim() || value.trim().length > 100))) {
        return res.status(400).json({ message: `${field} must be a list of non-empty names up to 100 characters` });
      }
      if (updates[field]) updates[field] = [...new Set(updates[field].map((value) => value.trim()))];
    }
    if (updates.leaveQuotas !== undefined && (!updates.leaveQuotas || typeof updates.leaveQuotas !== "object" || ["annual", "sick", "casual"].some((type) => updates.leaveQuotas[type] !== undefined && (!Number.isInteger(updates.leaveQuotas[type]) || updates.leaveQuotas[type] < 0 || updates.leaveQuotas[type] > 365)))) {
      return res.status(400).json({ message: "Leave quotas must be whole numbers between 0 and 365" });
    }
    if (updates.payroll !== undefined && (!updates.payroll || typeof updates.payroll !== "object" || ["hraRate", "medicalRate", "grossMultiplier"].some((field) => updates.payroll[field] !== undefined && (!Number.isFinite(updates.payroll[field]) || updates.payroll[field] < 0 || updates.payroll[field] > 10)))) {
      return res.status(400).json({ message: "Payroll rates must be numbers between 0 and 10" });
    }
    const settings = await getOrCreateSettings();
    const before = Object.fromEntries(Object.keys(updates).map((key) => [key, settings[key]]));
    for (const [key, value] of Object.entries(updates)) {
      if (["leaveQuotas", "payroll"].includes(key)) {
        settings[key] = { ...settings[key].toObject(), ...value };
      } else {
        settings[key] = value;
      }
    }
    await settings.save();
    await AuditLog.create({
      actor: req.user.userId,
      action: "organization.settings.updated",
      entity: "OrganizationSettings",
      entityId: String(settings._id),
      before,
      after: updates,
    });
    res.json({ settings });
  } catch (error) {
    console.error("Organization settings update failed", error);
    res.status(error?.name === "ValidationError" || error?.name === "CastError" ? 400 : 500).json({ message: "Unable to update organization settings" });
  }
};

export const listAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const [logs, total] = await Promise.all([
      AuditLog.find().populate("actor", "firstName lastName email role").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AuditLog.countDocuments(),
    ]);
    res.json({ logs, pagination: { page, limit, total } });
  } catch (error) {
    console.error("Audit log listing failed", error);
    res.status(500).json({ message: "Unable to load audit logs" });
  }
};
