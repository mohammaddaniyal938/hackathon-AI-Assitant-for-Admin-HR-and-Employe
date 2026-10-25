import { Router } from "express";
import auth, { requireRoles } from "../middlewares/auth.js";
import {
  createEmployee,
  getEmployee,
  listEmployees,
  setEmployeeStatus,
  updateEmployee,
} from "../controllers/employeeController.js";

const router = Router();

router.get("/", auth, requireRoles("admin", "hr"), listEmployees);
router.post("/", auth, requireRoles("admin", "hr"), createEmployee);
router.get("/:id", auth, getEmployee);
router.patch("/:id", auth, updateEmployee);
router.patch("/:id/status", auth, requireRoles("admin", "hr"), setEmployeeStatus);

export default router;
