import { Router } from "express";
import auth, { requireRoles } from "../middlewares/auth.js";
import {
  applyForLeave,
  cancelLeave,
  getLeaveBalance,
  listLeaveRequests,
  reviewLeave,
} from "../controllers/leaveController.js";

const router = Router();

router.use(auth);
router.get("/", listLeaveRequests);
router.get("/balance", getLeaveBalance);
router.post("/", requireRoles("employee"), applyForLeave);
router.patch("/:id/cancel", requireRoles("employee"), cancelLeave);
router.patch("/:id/review", requireRoles("admin", "hr"), reviewLeave);

export default router;
