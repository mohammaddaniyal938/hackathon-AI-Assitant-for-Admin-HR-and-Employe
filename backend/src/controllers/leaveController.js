import LeaveRequest from "../models/LeaveRequest.js";
import OrganizationSettings from "../models/OrganizationSettings.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import mongoose from "mongoose";

const quotasFor = async () => {
  let settings = await OrganizationSettings.findOne({ key: "default" });
  if (!settings) settings = await OrganizationSettings.create({ key: "default" });
  return settings;
};

const toDate = (input) => {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(`${input}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input ? null : date;
};

const workingDaysForRange = (startDate, endDate, settings) => {
  const holidays = new Set(settings.holidays.map((date) => new Date(date).toISOString().slice(0, 10)));
  let days = 0;
  for (const date = new Date(startDate); date <= endDate; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10);
    if (!settings.weekendDays.includes(date.getUTCDay()) && !holidays.has(key)) days++;
  }
  return days;
};

const listFilter = (user, requestedEmployeeId) => {
  if (user.role === "employee") return { employee: user.userId };
  return requestedEmployeeId ? { employee: requestedEmployeeId } : {};
};

export const listLeaveRequests = async (req, res) => {
  try {
    const filter = listFilter(req.user, req.query.employeeId);
    if (req.query.status) filter.status = req.query.status;
    const leaves = await LeaveRequest.find(filter)
      .populate("employee", "firstName lastName email employeeCode department")
      .populate("reviewedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(500);
    res.json({ leaves });
  } catch (error) {
    console.error("Leave listing failed", error);
    res.status(500).json({ message: "Unable to load leave requests" });
  }
};

export const getLeaveBalance = async (req, res) => {
  try {
    const settings = await quotasFor();
    const employeeId = req.user.role === "employee" ? req.user.userId : String(req.query.employeeId || "");
    if (!employeeId) return res.status(400).json({ message: "Employee ID is required" });
    if (!mongoose.isValidObjectId(employeeId)) return res.status(400).json({ message: "Invalid employee ID" });
    const employee = await User.findById(employeeId).select("_id");
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    const used = await LeaveRequest.aggregate([
      { $match: { employee: employee._id, status: "approved" } },
      { $group: { _id: "$leaveType", days: { $sum: "$workingDays" } } },
    ]);
    const usedByType = Object.fromEntries(used.map((item) => [item._id, item.days]));
    const balance = Object.fromEntries(["annual", "sick", "casual"].map((type) => [
      type,
      { quota: settings.leaveQuotas[type], used: usedByType[type] || 0, remaining: Math.max(0, settings.leaveQuotas[type] - (usedByType[type] || 0)) },
    ]));
    balance.unpaid = { quota: null, used: usedByType.unpaid || 0, remaining: null };
    res.json({ balance });
  } catch (error) {
    console.error("Leave balance lookup failed", error);
    res.status(500).json({ message: "Unable to load leave balance" });
  }
};

export const applyForLeave = async (req, res) => {
  try {
    const { leaveType, startDate: startInput, endDate: endInput, reason } = req.body || {};
    const startDate = toDate(startInput);
    const endDate = toDate(endInput);
    if (!["annual", "sick", "casual", "unpaid"].includes(leaveType)) {
      return res.status(400).json({ message: "Select a valid leave type" });
    }
    if (!startDate || !endDate || startDate > endDate) {
      return res.status(400).json({ message: "Start date must be on or before a valid end date" });
    }
    if (typeof reason !== "string" || !reason.trim()) return res.status(400).json({ message: "A reason is required" });

    const existing = await LeaveRequest.findOne({
      employee: req.user.userId,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: new Date(endDate.getTime() + 86400000 - 1) },
      endDate: { $gte: startDate },
    });
    if (existing) return res.status(409).json({ message: "This request overlaps another pending or approved leave request" });

    const settings = await quotasFor();
    const workingDays = workingDaysForRange(startDate, endDate, settings);
    if (workingDays === 0) return res.status(400).json({ message: "The selected dates contain no working days" });
    if (leaveType !== "unpaid") {
      const employeeObjectId = new mongoose.Types.ObjectId(req.user.userId);
      const used = await LeaveRequest.aggregate([
        { $match: { employee: employeeObjectId, status: "approved", leaveType } },
        { $group: { _id: null, days: { $sum: "$workingDays" } } },
      ]);
      const alreadyUsed = used[0]?.days || 0;
      const pending = await LeaveRequest.aggregate([
        { $match: { employee: employeeObjectId, status: "pending", leaveType } },
        { $group: { _id: null, days: { $sum: "$workingDays" } } },
      ]);
      if (alreadyUsed + (pending[0]?.days || 0) + workingDays > settings.leaveQuotas[leaveType]) {
        return res.status(400).json({ message: `Request exceeds your remaining ${leaveType} leave balance` });
      }
    }
    const leave = await LeaveRequest.create({
      employee: req.user.userId,
      leaveType,
      startDate,
      endDate,
      workingDays,
      reason: reason.trim(),
    });
    res.status(201).json({ leave, message: "Leave request submitted" });
  } catch (error) {
    console.error("Leave application failed", error);
    res.status(500).json({ message: "Unable to submit leave request" });
  }
};

export const cancelLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findOne({ _id: req.params.id, employee: req.user.userId });
    if (!leave) return res.status(404).json({ message: "Leave request not found" });
    if (leave.status !== "pending") return res.status(409).json({ message: "Only pending leave requests can be cancelled" });
    const result = await LeaveRequest.updateOne(
      { _id: leave._id, employee: req.user.userId, status: "pending" },
      { $set: { status: "cancelled" } }
    );
    if (result.modifiedCount !== 1) return res.status(409).json({ message: "Leave request has already been reviewed" });
    const cancelled = await LeaveRequest.findById(leave._id);
    await AuditLog.create({
      actor: req.user.userId,
      action: "leave.cancelled",
      entity: "LeaveRequest",
      entityId: String(leave._id),
      before: { status: "pending" },
      after: { status: "cancelled" },
    });
    res.json({ leave: cancelled, message: "Leave request cancelled" });
  } catch (error) {
    console.error("Leave cancellation failed", error);
    res.status(error?.name === "CastError" ? 400 : 500).json({ message: "Unable to cancel leave request" });
  }
};

export const reviewLeave = async (req, res) => {
  try {
    const { decision, comment = "" } = req.body || {};
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be approved or rejected" });
    }
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave request not found" });
    if (leave.status !== "pending") return res.status(409).json({ message: "Leave request has already been reviewed" });

    if (decision === "approved" && leave.leaveType !== "unpaid") {
      const settings = await quotasFor();
      const used = await LeaveRequest.aggregate([
        { $match: { employee: leave.employee, status: "approved", leaveType: leave.leaveType } },
        { $group: { _id: null, days: { $sum: "$workingDays" } } },
      ]);
      if ((used[0]?.days || 0) + leave.workingDays > settings.leaveQuotas[leave.leaveType]) {
        return res.status(409).json({ message: "The employee no longer has enough leave balance to approve this request" });
      }
    }
    const before = { status: leave.status };
    const result = await LeaveRequest.updateOne(
      { _id: leave._id, status: "pending" },
      { $set: { status: decision, reviewedBy: req.user.userId, reviewedAt: new Date(), reviewComment: String(comment).slice(0, 1000) } }
    );
    if (result.modifiedCount !== 1) return res.status(409).json({ message: "Leave request has already been reviewed" });
    const updated = await LeaveRequest.findById(leave._id).populate("employee", "firstName lastName email employeeCode");
    await AuditLog.create({
      actor: req.user.userId,
      action: `leave.${decision}`,
      entity: "LeaveRequest",
      entityId: String(leave._id),
      before,
      after: { status: decision, comment: String(comment).slice(0, 1000) },
    });
    res.json({ leave: updated, message: `Leave request ${decision}` });
  } catch (error) {
    console.error("Leave review failed", error);
    res.status(500).json({ message: "Unable to review leave request" });
  }
};
