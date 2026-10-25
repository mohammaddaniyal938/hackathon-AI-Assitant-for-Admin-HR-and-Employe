import Attendance from "../models/Attendance.js";
import AuditLog from "../models/AuditLog.js";
import LeaveRequest from "../models/LeaveRequest.js";
import OrganizationSettings from "../models/OrganizationSettings.js";
import PayrollRun from "../models/PayrollRun.js";
import User from "../models/User.js";

const todayKey = (timezone = "UTC") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const kpi = (label, value, tone = "sky", delta = "") => ({ label, value: String(value), tone, delta });

const startOfWeek = (timezone = "UTC") => {
  const date = new Date(`${todayKey(timezone)}T12:00:00.000Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
};

export const getDashboardOverview = async (req, res) => {
  try {
    const role = req.user.role;
    const settings = await OrganizationSettings.findOne({ key: "default" }).lean();
    const timezone = settings?.timezone || "UTC";
    const workDate = todayKey(timezone);
    const name = `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || req.user.email;
    const userSummary = {
      id: req.user.userId,
      name,
      email: req.user.email,
      role,
      department: req.user.department || "",
    };

    if (role === "employee") {
      const [records, leaves, latestRun] = await Promise.all([
        Attendance.find({ employee: req.user.userId, workDate: { $gte: startOfWeek(timezone), $lte: workDate } }).sort({ workDate: -1 }).lean(),
        LeaveRequest.find({ employee: req.user.userId }).sort({ createdAt: -1 }).limit(20).lean(),
        PayrollRun.findOne({ status: "finalized", "entries.employee": req.user.userId }).sort({ period: -1 }).lean(),
      ]);
      const quotas = settings?.leaveQuotas || { annual: 14, sick: 8, casual: 10 };
      const leaveBalance = {};
      for (const type of ["annual", "sick", "casual"]) {
        const used = leaves.filter((leave) => leave.status === "approved" && leave.leaveType === type)
          .reduce((sum, leave) => sum + leave.workingDays, 0);
        leaveBalance[type] = Math.max(0, quotas[type] - used);
      }
      const hoursThisWeek = records.reduce((sum, record) => {
        if (!record.checkIn || !record.checkOut) return sum;
        return sum + Math.max(0, (new Date(record.checkOut) - new Date(record.checkIn)) / 3600000);
      }, 0);
      const currentAttendance = await Attendance.findOne({ employee: req.user.userId, workDate }).lean();
      const latestPayslip = latestRun?.entries.find((entry) => String(entry.employee) === req.user.userId) || null;
      const kpis = [
        kpi("Hours This Week", `${hoursThisWeek.toFixed(1)}h`, "emerald", "Target: 40h"),
        kpi("Late Count", records.filter((record) => record.status === "late").length, "amber", "This week"),
        kpi("Annual Leave Balance", `${leaveBalance.annual} days`, "sky", "Remaining"),
        kpi("Today's Attendance", currentAttendance?.checkOut ? "Checked out" : currentAttendance?.checkIn ? "Checked in" : "Not checked in", "violet"),
      ];
      return res.json({
        role,
        user: userSummary,
        kpis,
        departmentBreakdown: [],
        recentActivity: [],
        approvals: [],
        employeeAttendance: records,
        employeeLeaves: leaves,
        leaveBalance,
        latestPayslip: latestPayslip ? { period: latestRun.period, ...latestPayslip } : null,
        assistant: { summary: "Open the floating HCM AI Assistant for role-aware guidance. It does not read or change employee records.", quickActions: [] },
      });
    }

    const activeEmployeeIds = await User.find({ role: "employee", status: "Active" }).distinct("_id");
    const [people, todayAttendance, onLeave, pendingLeaves, pendingCorrections, departmentCounts, recentLogs, pendingLeaveItems, pendingCorrectionItems] = await Promise.all([
      User.find({ role: "employee", status: "Active" }).select("_id department salary"),
      Attendance.find({ employee: { $in: activeEmployeeIds }, workDate }).select("employee status checkIn checkOut"),
      LeaveRequest.find({
        employee: { $in: activeEmployeeIds },
        status: "approved",
        startDate: { $lte: new Date(`${workDate}T23:59:59.999Z`) },
        endDate: { $gte: new Date(`${workDate}T00:00:00.000Z`) },
      }).select("employee"),
      LeaveRequest.countDocuments({ status: "pending" }),
      Attendance.countDocuments({ employee: { $in: activeEmployeeIds }, "corrections.status": "pending" }),
      User.aggregate([
        { $match: { role: "employee", status: "Active" } },
        { $group: { _id: { $ifNull: ["$department", "Unassigned"] }, count: { $sum: 1 }, salary: { $sum: "$salary" } } },
        { $sort: { count: -1 } },
      ]),
      AuditLog.find().populate("actor", "firstName lastName email").sort({ createdAt: -1 }).limit(8).lean(),
      LeaveRequest.find({ status: "pending" }).populate("employee", "firstName lastName").sort({ createdAt: 1 }).limit(5).lean(),
      Attendance.find({ employee: { $in: activeEmployeeIds }, "corrections.status": "pending" }).populate("employee", "firstName lastName").sort({ updatedAt: 1 }).limit(5).lean(),
    ]);

    const presentRecords = todayAttendance.filter((record) => ["present", "late", "half-day"].includes(record.status));
    const presentIds = new Set(presentRecords.map((record) => String(record.employee)));
    const leaveIds = new Set(onLeave.map((leave) => String(leave.employee)));
    const activePayroll = await PayrollRun.findOne({ period: workDate.slice(0, 7) }).select("totalGross totalNet status").lean();
    const isAdmin = role === "admin";
    const kpis = isAdmin
      ? [
          kpi("Active Employees", people.length, "emerald"),
          kpi("Present Today", presentRecords.length, "sky"),
          kpi("Absent Today", people.filter((person) => !presentIds.has(String(person._id)) && !leaveIds.has(String(person._id))).length, "amber"),
          kpi("On Leave", onLeave.length, "violet"),
          kpi("Late Arrivals", todayAttendance.filter((record) => record.status === "late").length, "amber"),
          kpi("Pending Approvals", pendingLeaves + pendingCorrections, "sky"),
          kpi("Current Payroll Gross", activePayroll ? `PKR ${activePayroll.totalGross.toLocaleString()}` : "Not generated", "violet"),
          kpi("Average Basic Salary", people.length ? `PKR ${Math.round(people.reduce((sum, person) => sum + (person.salary || 0), 0) / people.length).toLocaleString()}` : "PKR 0", "emerald"),
        ]
      : [
          kpi("Present Today", presentRecords.length, "emerald"),
          kpi("Absent Today", people.filter((person) => !presentIds.has(String(person._id)) && !leaveIds.has(String(person._id))).length, "amber"),
          kpi("Late Arrivals", todayAttendance.filter((record) => record.status === "late").length, "amber"),
          kpi("On Leave", onLeave.length, "sky"),
          kpi("Pending Leave Requests", pendingLeaves, "violet"),
          kpi("Pending Corrections", pendingCorrections, "sky"),
        ];

    const departmentBreakdown = departmentCounts.map((department) => ({
      name: department._id,
      value: department.count,
      salary: department.salary || 0,
    }));
    const recentActivity = recentLogs.map((log) => ({
      id: String(log._id),
      title: log.action,
      time: log.createdAt,
      details: log.actor ? `${log.actor.firstName || ""} ${log.actor.lastName || ""}`.trim() || log.actor.email : "System",
    }));
    const approvals = [
      ...pendingLeaveItems.map((leave) => ({
        id: String(leave._id),
        name: leave.employee ? `${leave.employee.firstName || ""} ${leave.employee.lastName || ""}`.trim() || "Employee" : "Employee",
        type: `${leave.leaveType} leave`,
        status: leave.status,
      })),
      ...pendingCorrectionItems.flatMap((record) => record.corrections
        .filter((correction) => correction.status === "pending")
        .map((correction) => ({
          id: String(correction._id),
          name: record.employee ? `${record.employee.firstName || ""} ${record.employee.lastName || ""}`.trim() || "Employee" : "Employee",
          type: "attendance correction",
          status: correction.status,
        }))),
    ].slice(0, 8);

    res.json({
      role,
      user: userSummary,
      date: workDate,
      kpis,
      departmentBreakdown,
      recentActivity,
      approvals,
      attendanceSummary: {
        total: people.length,
        present: presentRecords.length,
        absent: people.filter((person) => !presentIds.has(String(person._id)) && !leaveIds.has(String(person._id))).length,
        late: todayAttendance.filter((record) => record.status === "late").length,
        onLeave: onLeave.length,
      },
      payroll: activePayroll,
      assistant: { summary: "Open the floating HCM AI Assistant for role-aware guidance. It does not read or change employee records.", quickActions: [] },
    });
  } catch (error) {
    console.error("Dashboard summary failed", error);
    res.status(500).json({ message: "Unable to load dashboard summary" });
  }
};
