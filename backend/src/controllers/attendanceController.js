import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import OrganizationSettings from "../models/OrganizationSettings.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import mongoose from "mongoose";

const getSettings = async () => {
  let settings = await OrganizationSettings.findOne({ key: "default" });
  if (!settings) settings = await OrganizationSettings.create({ key: "default" });
  return settings;
};

const dateKeyInZone = (date, timezone) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const localTimeInZone = (date, timezone) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

const isWorkingDay = (dateKey, settings) => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  const holiday = settings.holidays.some((day) => new Date(day).toISOString().slice(0, 10) === dateKey);
  return !settings.weekendDays.includes(date.getUTCDay()) && !holiday;
};

const isValidDateKey = (value) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
  && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

const dateKeysBetween = (from, to) => {
  const keys = [];
  for (let date = Date.parse(`${from}T12:00:00.000Z`); date <= Date.parse(`${to}T12:00:00.000Z`); date += 86400000) {
    keys.push(new Date(date).toISOString().slice(0, 10));
  }
  return keys;
};

const attendanceHours = (record) => record.checkIn && record.checkOut
  ? Math.round(((new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) / 3600000) * 100) / 100
  : 0;

export const getMyAttendance = async (req, res) => {
  try {
    const settings = await getSettings();
    const today = dateKeyInZone(new Date(), settings.timezone);
    const month = today.slice(0, 7);
    const { from, to, month: requestedMonth, status } = req.query;
    if (requestedMonth !== undefined && (typeof requestedMonth !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth))) {
      return res.status(400).json({ message: "Month must use YYYY-MM format" });
    }
    if (requestedMonth && (from || to)) {
      return res.status(400).json({ message: "Choose a month or a date range, not both" });
    }
    if ((from && !isValidDateKey(from)) || (to && !isValidDateKey(to))) {
      return res.status(400).json({ message: "Date filters must use valid YYYY-MM-DD dates" });
    }
    if (from && to && from > to) {
      return res.status(400).json({ message: "Start date must be on or before end date" });
    }
    if (status !== undefined && !["present", "late", "half-day", "absent", "on-leave"].includes(status)) {
      return res.status(400).json({ message: "Choose a valid attendance status" });
    }

    const selectedFrom = requestedMonth ? `${requestedMonth}-01` : from || `${month}-01`;
    const selectedTo = requestedMonth
      ? new Date(Date.UTC(Number(requestedMonth.slice(0, 4)), Number(requestedMonth.slice(5, 7)), 0)).toISOString().slice(0, 10)
      : to || today;
    if (!requestedMonth && selectedFrom > selectedTo) {
      return res.status(400).json({ message: "Date range must be valid and start before its end" });
    }
    const selectedDays = (Date.parse(`${selectedTo}T00:00:00.000Z`) - Date.parse(`${selectedFrom}T00:00:00.000Z`)) / 86400000;
    if (selectedDays > 366) {
      return res.status(400).json({ message: "Attendance history is limited to 367 calendar days" });
    }

    const userId = req.user.userId;
    const monthStart = `${month}-01`;
    const [historyRecords, monthRecords, approvedLeaves, todayRecord, hasApprovedLeaveToday] = await Promise.all([
      Attendance.find({ employee: userId, workDate: { $gte: selectedFrom, $lte: selectedTo } }).sort({ workDate: -1, checkIn: -1 }).lean(),
      Attendance.find({ employee: userId, workDate: { $gte: monthStart, $lte: today } }).lean(),
      LeaveRequest.find({
        employee: userId,
        status: "approved",
        startDate: { $lte: new Date(`${selectedTo}T23:59:59.999Z`) },
        endDate: { $gte: new Date(`${selectedFrom}T00:00:00.000Z`) },
      }).select("startDate endDate").lean(),
      Attendance.findOne({ employee: userId, workDate: today }).lean(),
      LeaveRequest.exists({
        employee: userId,
        status: "approved",
        startDate: { $lte: new Date(`${today}T23:59:59.999Z`) },
        endDate: { $gte: new Date(`${today}T00:00:00.000Z`) },
      }),
    ]);

    const recordByDate = new Map(historyRecords.map((record) => [record.workDate, record]));
    const leaveDates = new Set();
    for (const leave of approvedLeaves) {
      const leaveStart = new Date(leave.startDate).toISOString().slice(0, 10);
      const leaveEnd = new Date(leave.endDate).toISOString().slice(0, 10);
      const start = leaveStart > selectedFrom ? leaveStart : selectedFrom;
      const end = leaveEnd < selectedTo ? leaveEnd : selectedTo;
      if (start <= end) {
        for (const date of dateKeysBetween(start, end)) {
          if (isWorkingDay(date, settings)) leaveDates.add(date);
        }
      }
    }

    const history = [];
    for (const date of dateKeysBetween(selectedFrom, selectedTo)) {
      const record = recordByDate.get(date);
      if (record) {
        history.push({ ...record, workingHours: attendanceHours(record) });
      } else if (leaveDates.has(date)) {
        history.push({ _id: `leave-${date}`, workDate: date, checkIn: null, checkOut: null, status: "on-leave", workingHours: 0 });
      } else if (date < today && isWorkingDay(date, settings)) {
        history.push({ _id: `absent-${date}`, workDate: date, checkIn: null, checkOut: null, status: "absent", workingHours: 0 });
      }
    }
    history.sort((left, right) => right.workDate.localeCompare(left.workDate));
    const filteredHistory = status ? history.filter((record) => record.status === status) : history;

    const monthlyRecords = new Map(monthRecords.map((record) => [record.workDate, record]));
    const approvedMonthLeaves = await LeaveRequest.find({
      employee: userId,
      status: "approved",
      startDate: { $lte: new Date(`${today}T23:59:59.999Z`) },
      endDate: { $gte: new Date(`${monthStart}T00:00:00.000Z`) },
    }).select("startDate endDate").lean();
    const monthlyLeaveDates = new Set();
    for (const leave of approvedMonthLeaves) {
      const start = new Date(leave.startDate).toISOString().slice(0, 10);
      const end = new Date(leave.endDate).toISOString().slice(0, 10);
      for (const date of dateKeysBetween(start > monthStart ? start : monthStart, end < today ? end : today)) {
        if (isWorkingDay(date, settings)) monthlyLeaveDates.add(date);
      }
    }

    const monthlySummary = { workingDays: 0, present: 0, late: 0, halfDay: 0, absent: 0, onLeave: 0, workingHours: 0 };
    for (const date of dateKeysBetween(monthStart, today)) {
      if (!isWorkingDay(date, settings)) continue;
      monthlySummary.workingDays += 1;
      const record = monthlyRecords.get(date);
      if (record) {
        if (record.status === "present") monthlySummary.present += 1;
        else if (record.status === "late") monthlySummary.late += 1;
        else if (record.status === "half-day") monthlySummary.halfDay += 1;
        else if (record.status === "absent") monthlySummary.absent += 1;
        else if (record.status === "on-leave") monthlySummary.onLeave += 1;
        monthlySummary.workingHours += attendanceHours(record);
      } else if (monthlyLeaveDates.has(date)) {
        monthlySummary.onLeave += 1;
      } else if (date < today) {
        monthlySummary.absent += 1;
      }
    }
    monthlySummary.workingHours = Math.round(monthlySummary.workingHours * 100) / 100;

    res.json({
      timezone: settings.timezone,
      workDate: today,
      todayStatus: todayRecord?.checkOut ? "checked-out" : todayRecord?.checkIn ? "checked-in" : "not-checked-in",
      canCheckIn: !todayRecord && isWorkingDay(today, settings) && !hasApprovedLeaveToday,
      checkInUnavailableReason: !isWorkingDay(today, settings)
        ? "Check-in is unavailable on configured weekends or holidays."
        : hasApprovedLeaveToday
          ? "You have approved leave for today."
          : todayRecord
            ? "An attendance record already exists for today."
            : "",
      today: todayRecord ? { ...todayRecord, workingHours: attendanceHours(todayRecord) } : null,
      monthlySummary,
      attendance: filteredHistory,
    });
  } catch (error) {
    console.error("Personal attendance lookup failed", error);
    res.status(500).json({ message: "Unable to load your attendance records" });
  }
};

export const checkIn = async (req, res) => {
  try {
    const now = new Date();
    const settings = await getSettings();
    const workDate = dateKeyInZone(now, settings.timezone);
    if (!isWorkingDay(workDate, settings)) {
      return res.status(400).json({ message: "Check-in is not available on configured weekends or holidays" });
    }
    const approvedLeave = await LeaveRequest.exists({
      employee: req.user.userId,
      status: "approved",
      startDate: { $lte: new Date(`${workDate}T23:59:59.999Z`) },
      endDate: { $gte: new Date(`${workDate}T00:00:00.000Z`) },
    });
    if (approvedLeave) return res.status(409).json({ message: "You have approved leave for today" });

    const officeStart = settings.officeStart.split(":").map(Number);
    const clock = localTimeInZone(now, settings.timezone).split(":").map(Number);
    const late = clock[0] * 60 + clock[1] > officeStart[0] * 60 + officeStart[1] + settings.gracePeriodMinutes;
    const record = await Attendance.create({
      employee: req.user.userId,
      workDate,
      checkIn: now,
      status: late ? "late" : "present",
    });
    res.status(201).json({ attendance: record, message: late ? "Checked in and marked late" : "Checked in successfully" });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "You have already checked in today" });
    console.error("Attendance check-in failed", error);
    res.status(500).json({ message: "Unable to record check-in" });
  }
};

export const checkOut = async (req, res) => {
  try {
    const settings = await getSettings();
    const workDate = dateKeyInZone(new Date(), settings.timezone);
    const attendance = await Attendance.findOne({ employee: req.user.userId, workDate });
    if (!attendance?.checkIn) return res.status(404).json({ message: "No check-in found for today" });
    if (attendance.checkOut) return res.status(409).json({ message: "You have already checked out today" });
    const now = new Date();
    if (now <= attendance.checkIn) return res.status(400).json({ message: "Check-out must be after check-in" });
    const status = now.getTime() - attendance.checkIn.getTime() < 5 * 60 * 60 * 1000
      ? "half-day"
      : attendance.status === "late" ? "late" : "present";
    const result = await Attendance.updateOne(
      { _id: attendance._id, checkOut: null, checkIn: { $lt: now } },
      { $set: { checkOut: now, status } }
    );
    if (result.modifiedCount !== 1) return res.status(409).json({ message: "Attendance was checked out or changed concurrently" });
    const updatedAttendance = await Attendance.findById(attendance._id);
    res.json({ attendance: updatedAttendance, message: "Checked out successfully" });
  } catch (error) {
    console.error("Attendance check-out failed", error);
    res.status(500).json({ message: "Unable to record check-out" });
  }
};

export const listAttendance = async (req, res) => {
  try {
    const { from, to, department, employeeId } = req.query;
    const filter = {};
    if (req.user.role === "employee") filter.employee = req.user.userId;
    else {
      const employeeFilter = { role: "employee" };
      if (typeof department === "string" && department.trim()) employeeFilter.department = department.trim();
      if (typeof employeeId === "string" && employeeId.trim()) {
        const search = employeeId.trim();
        const employee = await User.findOne({
          ...employeeFilter,
          $or: [
            ...(mongoose.isValidObjectId(search) ? [{ _id: search }] : []),
            { employeeCode: search },
            { email: search.toLowerCase() },
          ],
        }).select("_id").lean();
        filter.employee = employee?._id || null;
      } else {
        filter.employee = { $in: await User.find(employeeFilter).distinct("_id") };
      }
    }
    if (from || to) {
      filter.workDate = {};
      if (from) filter.workDate.$gte = from;
      if (to) filter.workDate.$lte = to;
    }
    const attendance = await Attendance.find(filter)
      .populate("employee", "firstName lastName email employeeCode department")
      .sort({ workDate: -1, checkIn: -1 })
      .limit(500);
    res.json({ attendance });
  } catch (error) {
    console.error("Attendance listing failed", error);
    res.status(500).json({ message: "Unable to load attendance records" });
  }
};

export const requestCorrection = async (req, res) => {
  try {
    const { workDate, reason, requestedCheckIn, requestedCheckOut } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate || "") || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ message: "Work date and correction reason are required" });
    }
    if (new Date(`${workDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== workDate) {
      return res.status(400).json({ message: "Enter a valid work date" });
    }
    const settings = await getSettings();
    const today = dateKeyInZone(new Date(), settings.timezone);
    if (workDate > today) {
      return res.status(400).json({ message: "Attendance corrections can only be requested for today or an earlier date" });
    }
    const checkIn = requestedCheckIn ? new Date(requestedCheckIn) : null;
    const checkOut = requestedCheckOut ? new Date(requestedCheckOut) : null;
    if ((checkIn && Number.isNaN(checkIn.getTime())) || (checkOut && Number.isNaN(checkOut.getTime()))) {
      return res.status(400).json({ message: "Enter valid requested check-in and check-out times" });
    }
    if ((checkIn && checkIn > new Date()) || (checkOut && checkOut > new Date())) {
      return res.status(400).json({ message: "Requested attendance times cannot be in the future" });
    }
    if ((checkIn && dateKeyInZone(checkIn, settings.timezone) !== workDate) || (checkOut && dateKeyInZone(checkOut, settings.timezone) !== workDate)) {
      return res.status(400).json({ message: "Corrected timestamps must fall within the requested workday in the organization timezone" });
    }
    if (checkIn && checkOut && checkOut <= checkIn) {
      return res.status(400).json({ message: "Requested check-out must be after check-in" });
    }
    let attendance = await Attendance.findOne({ employee: req.user.userId, workDate });
    if (!attendance && workDate === today) {
      return res.status(400).json({ message: "Use check-in to record today's attendance" });
    }
    if (!checkIn && !checkOut) {
      return res.status(400).json({ message: "Provide a corrected check-in or check-out time" });
    }
    if (!attendance && !checkIn) {
      return res.status(400).json({ message: "A check-in time is required when requesting a correction for a missing attendance record" });
    }
    if (!attendance) {
      try {
        attendance = await Attendance.create({ employee: req.user.userId, workDate, status: "absent" });
      } catch (error) {
        if (error?.code !== 11000) throw error;
        attendance = await Attendance.findOne({ employee: req.user.userId, workDate });
      }
    }
    const updated = await Attendance.findOneAndUpdate(
      { _id: attendance._id, corrections: { $not: { $elemMatch: { status: "pending" } } } },
      { $push: { corrections: { requestedBy: req.user.userId, reason: reason.trim(), requestedCheckIn: checkIn, requestedCheckOut: checkOut } } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(409).json({ message: "A correction request is already pending for this workday" });
    await AuditLog.create({
      actor: req.user.userId,
      action: "attendance.correction.requested",
      entity: "Attendance",
      entityId: String(updated._id),
      after: { workDate, correctionId: String(updated.corrections.at(-1)._id) },
    });
    res.status(201).json({ attendance: updated, message: "Correction request submitted" });
  } catch (error) {
    console.error("Attendance correction request failed", error);
    res.status(500).json({ message: "Unable to submit attendance correction" });
  }
};

export const reviewCorrection = async (req, res) => {
  try {
    const { decision, comment = "" } = req.body || {};
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be approved or rejected" });
    }
    const attendance = await Attendance.findOne({ "corrections._id": req.params.correctionId });
    if (!attendance) return res.status(404).json({ message: "Correction request not found" });
    const correction = attendance.corrections.id(req.params.correctionId);
    if (correction.status !== "pending") return res.status(409).json({ message: "Correction request has already been reviewed" });
    const before = { checkIn: attendance.checkIn, checkOut: attendance.checkOut };
    let updatedCheckIn = attendance.checkIn;
    let updatedCheckOut = attendance.checkOut;
    let updatedStatus = attendance.status;
    if (decision === "approved") {
      const checkIn = correction.requestedCheckIn || attendance.checkIn;
      const checkOut = correction.requestedCheckOut || attendance.checkOut;
      if (checkIn && checkOut && checkOut <= checkIn) {
        return res.status(400).json({ message: "Corrected check-out must be after check-in" });
      }
      updatedCheckIn = checkIn;
      updatedCheckOut = checkOut;
      if (checkIn) {
        const settings = await getSettings();
        const clock = localTimeInZone(checkIn, settings.timezone).split(":").map(Number);
        const officeStart = settings.officeStart.split(":").map(Number);
        updatedStatus = clock[0] * 60 + clock[1] > officeStart[0] * 60 + officeStart[1] + settings.gracePeriodMinutes ? "late" : "present";
        if (checkOut && checkOut.getTime() - checkIn.getTime() < 5 * 60 * 60 * 1000) updatedStatus = "half-day";
      }
    }
    const commentText = String(comment).slice(0, 1000);
    const result = await Attendance.updateOne(
      { _id: attendance._id, corrections: { $elemMatch: { _id: correction._id, status: "pending" } } },
      { $set: {
        "corrections.$.status": decision,
        "corrections.$.reviewedBy": req.user.userId,
        "corrections.$.reviewedAt": new Date(),
        "corrections.$.reviewComment": commentText,
        ...(decision === "approved" ? { checkIn: updatedCheckIn, checkOut: updatedCheckOut, status: updatedStatus } : {}),
      } }
    );
    if (result.modifiedCount !== 1) return res.status(409).json({ message: "Correction request has already been reviewed" });
    const reviewedAttendance = await Attendance.findById(attendance._id);
    await AuditLog.create({
      actor: req.user.userId,
      action: `attendance.correction.${decision}`,
      entity: "Attendance",
      entityId: String(reviewedAttendance._id),
      before,
      after: { checkIn: reviewedAttendance.checkIn, checkOut: reviewedAttendance.checkOut, comment: commentText },
    });
    res.json({ attendance: reviewedAttendance, message: `Correction ${decision}` });
  } catch (error) {
    console.error("Attendance correction review failed", error);
    res.status(500).json({ message: "Unable to review attendance correction" });
  }
};

export const getAttendanceOverview = async (req, res) => {
  try {
    const settings = await getSettings();
    const workDate = dateKeyInZone(new Date(), settings.timezone);
    const people = await User.find({ role: "employee", status: "Active" }).select("_id department");
    const employeeIds = people.map((person) => person._id);
    const records = await Attendance.find({ workDate, employee: { $in: employeeIds } });
    const onLeave = await LeaveRequest.find({
      employee: { $in: employeeIds },
      status: "approved",
      startDate: { $lte: new Date(`${workDate}T23:59:59.999Z`) },
      endDate: { $gte: new Date(`${workDate}T00:00:00.000Z`) },
    }).distinct("employee");
    const recordIds = new Set(records.filter((record) => ["present", "late", "half-day"].includes(record.status)).map((item) => String(item.employee)));
    const leaveIds = new Set(onLeave.map(String));
    const pendingCorrections = await Attendance.countDocuments({ employee: { $in: employeeIds }, "corrections.status": "pending" });
    res.json({
      date: workDate,
      total: people.length,
      present: records.filter((record) => ["present", "late", "half-day"].includes(record.status)).length,
      late: records.filter((record) => record.status === "late").length,
      halfDay: records.filter((record) => record.status === "half-day").length,
      missingCheckout: records.filter((record) => record.checkIn && !record.checkOut).length,
      onLeave: onLeave.length,
      absent: people.filter((person) => !recordIds.has(String(person._id)) && !leaveIds.has(String(person._id))).length,
      pendingCorrections,
      departments: [...new Set(people.map((person) => person.department).filter(Boolean))],
    });
  } catch (error) {
    console.error("Attendance overview failed", error);
    res.status(500).json({ message: "Unable to load attendance overview" });
  }
};

export const getAttendanceTrends = async (req, res) => {
  try {
    const { from, to } = req.query;
    const validDateKey = (value) => typeof value === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
      && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
    if (!validDateKey(from) || !validDateKey(to) || from > to) {
      return res.status(400).json({ message: "Provide a valid date range using YYYY-MM-DD" });
    }
    const days = (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000;
    if (days > 366) return res.status(400).json({ message: "Attendance trends are limited to 367 calendar days" });
    const employeeIds = await User.find({ role: "employee" }).distinct("_id");
    const trends = await Attendance.aggregate([
      { $match: { employee: { $in: employeeIds }, workDate: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$workDate",
          records: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ["$status", ["present", "late", "half-day"]] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
          halfDay: { $sum: { $cond: [{ $eq: ["$status", "half-day"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({ from, to, trends: trends.map(({ _id, ...counts }) => ({ date: _id, ...counts })) });
  } catch (error) {
    console.error("Attendance trend report failed", error);
    res.status(500).json({ message: "Unable to load attendance trends" });
  }
};
