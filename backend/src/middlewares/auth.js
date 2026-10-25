import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = header.slice("Bearer ".length).trim();
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  if (!decoded || typeof decoded !== "object" || typeof decoded.userId !== "string") {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  try {
    const user = await User.findById(decoded.userId).select("_id email role firstName lastName department status isTempPassword");
    if (!user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (user.status !== "Active") {
      return res.status(401).json({ message: "This account is inactive. Contact an administrator." });
    }

    if (user.isTempPassword && !(req.baseUrl === "/api/auth" && ["/me", "/logout", "/change-password"].includes(req.path))) {
      return res.status(403).json({ message: "Change your temporary password before continuing" });
    }

    if (decoded.role && decoded.role !== user.role) {
      return res.status(401).json({ message: "Session role has changed; sign in again" });
    }

    req.user = {
      userId: String(user._id),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      status: user.status,
      isTempPassword: user.isTempPassword,
    };
    return next();
  } catch (error) {
    console.error("Authentication lookup failed", error);
    return res.status(500).json({ message: "Unable to authenticate request" });
  }
};

export default auth;

export const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "You do not have permission to perform this action" });
  }

  return next();
};
