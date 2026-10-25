import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";

const normalizeUser = (user) => ({
  id: user._id,
  email: user.email,
  role: user.role || "employee",
  firstName: user.firstName || "",
  lastName: user.lastName || "",
  employeeCode: user.employeeCode || "",
  department: user.department || "",
  designation: user.designation || "",
  status: user.status || "Active",
  joiningDate: user.joiningDate ? new Date(user.joiningDate).toISOString().slice(0, 10) : null,
  salary: user.salary || 0,
  isTempPassword: Boolean(user.isTempPassword),
});

export const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, employeeCode, department, designation } = req.body || {};

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password are required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
      return res.status(400).json({ message: "Enter a valid email and a password of at least 6 characters" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const user = await User.create({
      email: normalizedEmail,
      password,
      role: "employee",
      firstName: firstName || "",
      lastName: lastName || "",
      employeeCode: employeeCode || "",
      department: department || "",
      designation: designation || "",
      isTempPassword: true,
    });

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      accessToken,
      refreshToken,
      user: normalizeUser(user),
    });
  } catch (err) {
    console.error("Registration failed", err);
    res.status(500).json({ message: "Unable to create account" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || user.status !== "Active") {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      accessToken,
      refreshToken,
      user: normalizeUser(user),
    });
  } catch (err) {
    console.error("Login failed", err);
    res.status(500).json({ message: "Unable to sign in" });
  }
};

export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await User.findById(payload.userId);
    if (!user || user.status !== "Active" || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = generateAccessToken(user._id, user.role);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("Token refresh failed", err);
    res.status(500).json({ message: "Unable to refresh session" });
  }
};

export const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout failed", err);
    res.status(500).json({ message: "Unable to log out" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ message: "Current and new passwords are required" });
    }
    if (newPassword.length < 12) {
      return res.status(400).json({ message: "New password must be at least 12 characters" });
    }
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "Choose a new password different from the current password" });
    }
    user.password = newPassword;
    user.isTempPassword = false;
    user.refreshToken = null;
    await user.save();
    res.json({ message: "Password changed. Sign in again with your new password." });
  } catch (error) {
    console.error("Password change failed", error);
    res.status(500).json({ message: "Unable to change password" });
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password -refreshToken");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user: normalizeUser(user) });
  } catch (err) {
    console.error("User profile lookup failed", err);
    res.status(500).json({ message: "Unable to retrieve user profile" });
  }
};
