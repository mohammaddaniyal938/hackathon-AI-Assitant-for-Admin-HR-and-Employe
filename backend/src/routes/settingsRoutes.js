import { Router } from "express";
import auth, { requireRoles } from "../middlewares/auth.js";
import { getOrganizationSettings, listAuditLogs, updateOrganizationSettings } from "../controllers/settingsController.js";

const router = Router();

router.use(auth);
router.get("/", requireRoles("admin", "hr"), getOrganizationSettings);
router.put("/", requireRoles("admin"), updateOrganizationSettings);
router.get("/audit", requireRoles("admin"), listAuditLogs);

export default router;
