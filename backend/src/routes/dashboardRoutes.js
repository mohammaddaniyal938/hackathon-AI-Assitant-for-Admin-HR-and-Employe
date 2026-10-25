import { Router } from "express";
import auth from "../middlewares/auth.js";
import { getDashboardOverview } from "../controllers/dashboardController.js";

const router = Router();

router.get("/summary", auth, getDashboardOverview);

export default router;
