import User from "../models/User.js";

export const seedInitialAdmin = async () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  if (await User.exists({ role: "admin" })) return;
  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error("ADMIN_EMAIL belongs to an existing non-admin account; choose a different initial admin email.");
  }
  await User.create({
    email,
    password,
    role: "admin",
    firstName: "Organization",
    lastName: "Admin",
    status: "Active",
    isTempPassword: true,
  });
  console.info(`Created the configured initial Admin account: ${email}`);
};

const demoUsers = [
  {
    email: "admin@company.com",
    password: "Admin123!",
    role: "admin",
    firstName: "Ayesha",
    lastName: "Khan",
    employeeCode: "ADM-001",
    department: "Administration",
    designation: "Chief Operations Officer",
    joiningDate: new Date("2022-01-15"),
    salary: 220000,
  },
  {
    email: "hr@company.com",
    password: "Hr12345!",
    role: "hr",
    firstName: "Usman",
    lastName: "Hafeez",
    employeeCode: "HR-101",
    department: "Human Resources",
    designation: "HR Manager",
    joiningDate: new Date("2023-05-05"),
    salary: 180000,
  },
  {
    email: "employee@company.com",
    password: "Employee123!",
    role: "employee",
    firstName: "Hassan",
    lastName: "Ali",
    employeeCode: "EMP-101",
    department: "Engineering",
    designation: "Frontend Developer",
    joiningDate: new Date("2024-02-10"),
    salary: 180000,
  },
];

export const seedMissingDemoUsers = async () => {
  for (const demoUser of demoUsers) {
    const existingUser = await User.findOne({ email: demoUser.email });
    if (existingUser) {
      continue;
    }

    try {
      await User.create({ ...demoUser, isTempPassword: false });
      console.info(`Created missing development demo account: ${demoUser.email}`);
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }
};
