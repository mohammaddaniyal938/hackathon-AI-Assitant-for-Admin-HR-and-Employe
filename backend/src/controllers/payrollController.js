import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import OrganizationSettings from "../models/OrganizationSettings.js";
import PayrollRun from "../models/PayrollRun.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

const settingsFor = async () => {
  let settings = await OrganizationSettings.findOne({ key: "default" });
  if (!settings) settings = await OrganizationSettings.create({ key: "default" });
  return settings;
};

const getMonthDates = (period) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period || "")) return null;
  const [year, month] = period.split("-").map(Number);
  return {
    first: new Date(Date.UTC(year, month - 1, 1)),
    last: new Date(Date.UTC(year, month, 0)),
    count: new Date(Date.UTC(year, month, 0)).getUTCDate(),
  };
};

const countWorkdays = (start, end, settings) => {
  const holidays = new Set(settings.holidays.map((date) => new Date(date).toISOString().slice(0, 10)));
  let total = 0;
  const date = new Date(start);
  while (date <= end) {
    const key = date.toISOString().slice(0, 10);
    if (!settings.weekendDays.includes(date.getUTCDay()) && !holidays.has(key)) total++;
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return total;
};

const buildPayrollEntries = async (period, settings) => {
  const dates = getMonthDates(period);
  if (!dates) throw new Error("Payroll period must use YYYY-MM format");
  const employees = await User.find({ role: "employee", status: "Active", salary: { $gt: 0 } })
    .select("_id firstName lastName employeeCode salary joiningDate terminationDate")
    .lean();
  const entries = [];

  for (const employee of employees) {
    const employmentStart = employee.joiningDate && employee.joiningDate > dates.first ? employee.joiningDate : dates.first;
    const employmentEnd = employee.terminationDate && employee.terminationDate < dates.last ? employee.terminationDate : dates.last;
    if (employmentStart > employmentEnd) continue;
    const eligibleDays = countWorkdays(employmentStart, employmentEnd, settings);
    if (eligibleDays === 0) continue;
    const grossFullMonth = employee.salary * settings.payroll.grossMultiplier;
    const grossProrated = grossFullMonth * eligibleDays / countWorkdays(dates.first, dates.last, settings);
    const dailyGross = grossFullMonth / countWorkdays(dates.first, dates.last, settings);
    const fromKey = employmentStart.toISOString().slice(0, 10);
    const toKey = employmentEnd.toISOString().slice(0, 10);

    const [attendance, approvedLeaves] = await Promise.all([
      Attendance.find({ employee: employee._id, workDate: { $gte: fromKey, $lte: toKey } }).select("workDate status").lean(),
      LeaveRequest.find({
        employee: employee._id,
        status: "approved",
        startDate: { $lte: dates.last },
        endDate: { $gte: dates.first },
      }).select("leaveType startDate endDate workingDays").lean(),
    ]);
    const attendedDates = new Set(attendance.map((row) => row.workDate));
    const halfDays = attendance.filter((row) => row.status === "half-day").length;
    let absentDays = 0;
    let unpaidLeaveDays = 0;
    const approvedDates = new Map();
    for (const leave of approvedLeaves) {
      const start = new Date(Math.max(new Date(leave.startDate).getTime(), employmentStart.getTime()));
      const end = new Date(Math.min(new Date(leave.endDate).getTime(), employmentEnd.getTime()));
      for (const day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
        const key = day.toISOString().slice(0, 10);
        if (countWorkdays(day, day, settings) === 1) approvedDates.set(key, leave.leaveType);
      }
    }
    const workDate = new Date(employmentStart);
    while (workDate <= employmentEnd) {
      const key = workDate.toISOString().slice(0, 10);
      if (countWorkdays(workDate, workDate, settings) === 1 && !attendedDates.has(key)) {
        const leaveType = approvedDates.get(key);
        if (leaveType === "unpaid") unpaidLeaveDays++;
        else if (!leaveType) absentDays++;
      }
      workDate.setUTCDate(workDate.getUTCDate() + 1);
    }
    const deductions = dailyGross * (absentDays + unpaidLeaveDays + halfDays * 0.5);
    const hra = employee.salary * settings.payroll.hraRate;
    const medicalAllowance = employee.salary * settings.payroll.medicalRate;
    entries.push({
      employee: employee._id,
      employeeCode: employee.employeeCode || "",
      employeeName: `${employee.firstName} ${employee.lastName}`.trim() || employee.employeeCode,
      basicSalary: employee.salary,
      hra,
      medicalAllowance,
      grossSalary: grossProrated,
      absentDays,
      halfDays,
      unpaidLeaveDays,
      deductions,
      netSalary: Math.max(0, grossProrated - deductions),
    });
  }
  return entries;
};

export const listPayrollRuns = async (_req, res) => {
  try {
    const runs = await PayrollRun.find().sort({ period: -1 }).limit(36);
    res.json({ payrollRuns: runs });
  } catch (error) {
    console.error("Payroll run listing failed", error);
    res.status(500).json({ message: "Unable to load payroll runs" });
  }
};

export const createPayrollDraft = async (req, res) => {
  try {
    const { period } = req.body || {};
    if (!getMonthDates(period)) return res.status(400).json({ message: "Payroll period must use YYYY-MM format" });
    const settings = await settingsFor();
    const currentParts = new Intl.DateTimeFormat("en-US", {
      timeZone: settings.timezone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const current = Object.fromEntries(currentParts.map(({ type, value }) => [type, value]));
    const currentPeriod = `${current.year}-${current.month}`;
    if (period >= currentPeriod) {
      return res.status(400).json({ message: "Create payroll only for a closed period before the current month" });
    }
    const entries = await buildPayrollEntries(period, settings);
    const run = await PayrollRun.create({
      period,
      entries,
      createdBy: req.user.userId,
      totalGross: entries.reduce((sum, entry) => sum + entry.grossSalary, 0),
      totalNet: entries.reduce((sum, entry) => sum + entry.netSalary, 0),
    });
    await AuditLog.create({
      actor: req.user.userId,
      action: "payroll.created",
      entity: "PayrollRun",
      entityId: String(run._id),
      after: { period, employeeCount: entries.length, totalGross: run.totalGross, totalNet: run.totalNet },
    });
    res.status(201).json({ payrollRun: run });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "A payroll run already exists for this period" });
    if (error.message.includes("Payroll period")) return res.status(400).json({ message: error.message });
    console.error("Payroll draft creation failed", error);
    res.status(500).json({ message: "Unable to create payroll draft" });
  }
};

export const reviewPayroll = async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.id);
    if (!run) return res.status(404).json({ message: "Payroll run not found" });
    if (run.status !== "draft") return res.status(409).json({ message: "Only draft payroll runs can be reviewed" });
    run.status = "reviewed";
    run.reviewedBy = req.user.userId;
    await run.save();
    await AuditLog.create({ actor: req.user.userId, action: "payroll.reviewed", entity: "PayrollRun", entityId: String(run._id) });
    res.json({ payrollRun: run });
  } catch (error) {
    console.error("Payroll review failed", error);
    res.status(500).json({ message: "Unable to review payroll run" });
  }
};

export const finalizePayroll = async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.id);
    if (!run) return res.status(404).json({ message: "Payroll run not found" });
    if (run.status !== "reviewed") return res.status(409).json({ message: "Only reviewed payroll runs can be finalized" });
    run.status = "finalized";
    run.finalizedBy = req.user.userId;
    run.finalizedAt = new Date();
    await run.save();
    await AuditLog.create({
      actor: req.user.userId,
      action: "payroll.finalized",
      entity: "PayrollRun",
      entityId: String(run._id),
      after: { period: run.period, totalNet: run.totalNet },
    });
    res.json({ payrollRun: run });
  } catch (error) {
    console.error("Payroll finalization failed", error);
    res.status(500).json({ message: "Unable to finalize payroll run" });
  }
};

export const lockPayroll = async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.id);
    if (!run) return res.status(404).json({ message: "Payroll run not found" });
    if (run.status !== "finalized") return res.status(409).json({ message: "Only finalized payroll runs can be locked" });
    run.status = "locked";
    await run.save();
    await AuditLog.create({
      actor: req.user.userId,
      action: "payroll.locked",
      entity: "PayrollRun",
      entityId: String(run._id),
      after: { period: run.period },
    });
    res.json({ payrollRun: run });
  } catch (error) {
    console.error("Payroll lock failed", error);
    res.status(500).json({ message: "Unable to lock payroll run" });
  }
};

export const getMyPayslips = async (req, res) => {
  try {
    const runs = await PayrollRun.find({ status: { $in: ["finalized", "locked"] }, "entries.employee": req.user.userId })
      .select("period status entries totalGross totalNet finalizedAt")
      .sort({ period: -1 })
      .limit(36)
      .lean();
    const payslips = runs.map((run) => ({
      period: run.period,
      finalizedAt: run.finalizedAt,
      ...run.entries.find((entry) => String(entry.employee) === req.user.userId),
    }));
    res.json({ payslips });
  } catch (error) {
    console.error("Payslip lookup failed", error);
    res.status(500).json({ message: "Unable to load payslips" });
  }
};
