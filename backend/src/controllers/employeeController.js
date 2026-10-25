import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import mongoose from "mongoose";

const employeeProjection = "-password -refreshToken";
const editableFields = [
  "firstName",
  "lastName",
  "email",
  "employeeCode",
  "department",
  "designation",
  "joiningDate",
  "salary",
  "status",
  "phoneNumber",
  "location",
  "employmentType",
  "manager",
];

const safeEmployee = (employee, includeSalary = true) => {
  const object = employee.toObject ? employee.toObject() : employee;
  delete object.password;
  delete object.refreshToken;
  if (!includeSalary) {
    delete object.salary;
  }
  return {
    ...object,
    id: String(object._id),
    joiningDate: object.joiningDate ? new Date(object.joiningDate).toISOString().slice(0, 10) : null,
  };
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const listEmployees = async (req, res) => {
  try {
    const {
      q = "",
      department,
      designation,
      status,
      location,
      sort = "lastName",
      order = "asc",
      page = "1",
      limit = "20",
    } = req.query;
    const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
    const filter = { role: "employee" };

    if (department) filter.department = department;
    if (designation) filter.designation = designation;
    if (status) filter.status = status;
    if (location) filter.location = location;
    if (typeof q === "string" && q.trim()) {
      const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { firstName: new RegExp(escaped, "i") },
        { lastName: new RegExp(escaped, "i") },
        { employeeCode: new RegExp(escaped, "i") },
        { email: new RegExp(escaped, "i") },
      ];
    }

    const sortField = ["firstName", "lastName", "employeeCode", "department", "joiningDate", "status"].includes(String(sort))
      ? String(sort)
      : "lastName";
    const direction = order === "desc" ? -1 : 1;
    const [employees, total] = await Promise.all([
      User.find(filter, employeeProjection)
        .sort({ [sortField]: direction, _id: 1 })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      employees: employees.map((employee) => safeEmployee(employee)),
      pagination: { page: parsedPage, limit: parsedLimit, total, pages: Math.ceil(total / parsedLimit) },
    });
  } catch (error) {
    console.error("Employee listing failed", error);
    res.status(500).json({ message: "Unable to load employees" });
  }
};

export const getEmployee = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid employee identifier" });
    if (req.user.role === "employee" && req.user.userId !== req.params.id) {
      return res.status(403).json({ message: "You may only view your own employee profile" });
    }
    const employee = await User.findOne({ _id: req.params.id, role: "employee" }).select(employeeProjection);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json({ employee: safeEmployee(employee, req.user.role !== "employee") });
  } catch (error) {
    console.error("Employee lookup failed", error);
    res.status(500).json({ message: "Unable to load employee profile" });
  }
};

export const createEmployee = async (req, res) => {
  try {
    const {
      firstName, lastName, email, employeeCode, department, designation,
      joiningDate, salary, phoneNumber, location, employmentType, manager, initialPassword,
    } = req.body || {};
    if (![firstName, lastName, email, employeeCode, department, designation].every((value) => typeof value === "string" && value.trim())) {
      return res.status(400).json({ message: "First name, last name, email, employee code, department, and designation are required" });
    }
    if (!isValidEmail(email.trim())) return res.status(400).json({ message: "Enter a valid email address" });
    if (salary !== undefined && (!Number.isFinite(Number(salary)) || Number(salary) < 0)) {
      return res.status(400).json({ message: "Salary must be a non-negative number" });
    }
    if (typeof initialPassword !== "string" || initialPassword.length < 12) {
      return res.status(400).json({ message: "Provide an initial password of at least 12 characters" });
    }
    if (joiningDate && (typeof joiningDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(joiningDate) || Number.isNaN(new Date(joiningDate).getTime()) || new Date(joiningDate).toISOString().slice(0, 10) !== joiningDate)) {
      return res.status(400).json({ message: "Enter a valid joining date" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = employeeCode.trim();
    if (await User.exists({ $or: [{ email: normalizedEmail }, { employeeCode: normalizedCode }] })) {
      return res.status(409).json({ message: "An account with that email or employee code already exists" });
    }

    const employee = await User.create({
      email: normalizedEmail,
      password: initialPassword,
      role: "employee",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      employeeCode: normalizedCode,
      department: department.trim(),
      designation: designation.trim(),
      joiningDate: joiningDate || new Date(),
      salary: Number(salary || 0),
      phoneNumber: phoneNumber || "",
      location: location || "",
      employmentType: employmentType || "Full-time",
      manager: manager || "",
      status: "Active",
      isTempPassword: true,
    });
    await AuditLog.create({
      actor: req.user.userId,
      action: "employee.created",
      entity: "User",
      entityId: String(employee._id),
      after: { email: employee.email, employeeCode: employee.employeeCode, department: employee.department },
    });
    res.status(201).json({
      employee: safeEmployee(employee),
      message: "Employee created. Share the initial password securely; the employee must change it at first sign-in.",
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "Email or employee code is already in use" });
    console.error("Employee creation failed", error);
    res.status(500).json({ message: "Unable to create employee" });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid employee identifier" });
    const updates = {};
    const allowedFields = req.user.role === "employee"
      ? ["phoneNumber", "location"]
      : editableFields;
    if (req.user.role === "employee" && req.user.userId !== req.params.id) {
      return res.status(403).json({ message: "You may only update your own permitted profile fields" });
    }
    for (const field of allowedFields) {
      if (Object.hasOwn(req.body || {}, field)) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No editable employee fields provided" });
    if (updates.email !== undefined) {
      if (typeof updates.email !== "string" || !isValidEmail(updates.email.trim())) {
        return res.status(400).json({ message: "Enter a valid email address" });
      }
      updates.email = updates.email.trim().toLowerCase();
    }
    if (updates.salary !== undefined && (!Number.isFinite(Number(updates.salary)) || Number(updates.salary) < 0)) {
      return res.status(400).json({ message: "Salary must be a non-negative number" });
    }
    if (updates.salary !== undefined) updates.salary = Number(updates.salary);
    if (updates.employeeCode !== undefined) {
      if (typeof updates.employeeCode !== "string" || !updates.employeeCode.trim()) {
        return res.status(400).json({ message: "Employee ID is required" });
      }
      updates.employeeCode = updates.employeeCode.trim();
    }
    if (updates.joiningDate !== undefined && (typeof updates.joiningDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(updates.joiningDate) || Number.isNaN(new Date(updates.joiningDate).getTime()) || new Date(updates.joiningDate).toISOString().slice(0, 10) !== updates.joiningDate)) {
      return res.status(400).json({ message: "Enter a valid joining date" });
    }

    const employee = await User.findOne({ _id: req.params.id, role: "employee" }).select(employeeProjection);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    if (updates.employeeCode && updates.employeeCode !== employee.employeeCode && await User.exists({ employeeCode: updates.employeeCode, role: "employee", _id: { $ne: employee._id } })) {
      return res.status(409).json({ message: "Employee ID is already in use" });
    }
    const before = Object.fromEntries(Object.keys(updates).map((key) => [key, employee[key]]));
    Object.assign(employee, updates);
    await employee.save();
    await AuditLog.create({
      actor: req.user.userId,
      action: "employee.updated",
      entity: "User",
      entityId: String(employee._id),
      before,
      after: updates,
    });
    res.json({ employee: safeEmployee(employee, req.user.role !== "employee") });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "Email or employee code is already in use" });
    console.error("Employee update failed", error);
    res.status(error?.name === "ValidationError" || error?.name === "CastError" ? 400 : 500).json({ message: "Unable to update employee" });
  }
};

export const setEmployeeStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid employee identifier" });
    const { status } = req.body || {};
    if (!["Active", "Inactive"].includes(status)) {
      return res.status(400).json({ message: "Status must be Active or Inactive" });
    }
    const employee = await User.findOneAndUpdate(
      { _id: req.params.id, role: "employee" },
      { $set: { status } },
      { new: true, runValidators: true, projection: employeeProjection }
    );
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    await AuditLog.create({
      actor: req.user.userId,
      action: status === "Active" ? "employee.reactivated" : "employee.deactivated",
      entity: "User",
      entityId: String(employee._id),
      after: { status },
    });
    res.json({ employee: safeEmployee(employee) });
  } catch (error) {
    console.error("Employee status update failed", error);
    res.status(500).json({ message: "Unable to update employee status" });
  }
};
