import { Router } from "express";
import auth, { requireRoles } from "../middlewares/auth.js";
import { getAssistantStatus, sendAssistantMessage } from "../controllers/assistantController.js";

const router = Router();
router.use(auth, requireRoles("admin", "hr", "employee"));
router.get("/status", getAssistantStatus);
router.post("/chat", sendAssistantMessage);

export default router;
