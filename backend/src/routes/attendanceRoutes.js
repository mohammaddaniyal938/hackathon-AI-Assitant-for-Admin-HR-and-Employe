import { Router } from "express";
import auth, { requireRoles } from "../middlewares/auth.js";
import {
  checkIn,
  checkOut,
  getAttendanceOverview,
  getAttendanceTrends,
  getMyAttendance,
  listAttendance,
  requestCorrection,
  reviewCorrection,
} from "../controllers/attendanceController.js";

const router = Router();

router.use(auth);
router.get("/self", requireRoles("hr"), getMyAttendance);
router.post("/self/check-in", requireRoles("hr"), checkIn);
router.post("/self/check-out", requireRoles("hr"), checkOut);
router.get("/overview", requireRoles("admin", "hr"), getAttendanceOverview);
router.get("/trends", requireRoles("admin", "hr"), getAttendanceTrends);
router.get("/", listAttendance);
router.post("/check-in", requireRoles("employee"), checkIn);
router.post("/check-out", requireRoles("employee"), checkOut);
router.post("/corrections", requireRoles("employee"), requestCorrection);
router.patch("/corrections/:correctionId", requireRoles("admin", "hr"), reviewCorrection);

export default router;
