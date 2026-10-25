import "./config/env.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import { seedInitialAdmin, seedMissingDemoUsers } from "./config/seedDemoUsers.js";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/assistant", assistantRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const startServer = async () => {
  try {
    await connectDB();

    await seedInitialAdmin();
    if (process.env.NODE_ENV !== "production" && process.env.SEED_DEMO_USERS !== "false") {
      await seedMissingDemoUsers();
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed while connecting to the database or initializing development demo accounts.");
    console.error(error);
    process.exitCode = 1;
  }
};

startServer();
