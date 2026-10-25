import { Router } from "express";
import auth, { requireRoles } from "../middlewares/auth.js";
import {
  createPayrollDraft,
  finalizePayroll,
  getMyPayslips,
  lockPayroll,
  listPayrollRuns,
  reviewPayroll,
} from "../controllers/payrollController.js";

const router = Router();

router.use(auth);
router.get("/my", requireRoles("employee"), getMyPayslips);
router.get("/", requireRoles("admin", "hr"), listPayrollRuns);
router.post("/", requireRoles("admin", "hr"), createPayrollDraft);
router.patch("/:id/review", requireRoles("admin", "hr"), reviewPayroll);
router.patch("/:id/finalize", requireRoles("admin"), finalizePayroll);
router.patch("/:id/lock", requireRoles("admin"), lockPayroll);

export default router;
