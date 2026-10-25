import bcrypt from "bcryptjs";

const hash = (value) => bcrypt.hashSync(value, 12);

const baseUsers = [
  {
    _id: "admin-1",
    email: "admin@company.com",
    password: hash("Admin123!"),
    role: "admin",
    firstName: "Ayesha",
    lastName: "Khan",
    employeeCode: "ADM-001",
    department: "Administration",
    designation: "Chief Operations Officer",
    status: "Active",
    joiningDate: "2022-01-15",
    salary: 220000,
    team: "Leadership",
    phoneNumber: "+92 300 0000001",
  },
  {
    _id: "hr-1",
    email: "hr@company.com",
    password: hash("Hr12345!"),
    role: "hr",
    firstName: "Usman",
    lastName: "Hafeez",
    employeeCode: "HR-101",
    department: "Human Resources",
    designation: "HR Manager",
    status: "Active",
    joiningDate: "2023-05-05",
    salary: 180000,
    team: "People Ops",
    phoneNumber: "+92 300 0000002",
  },
  {
    _id: "employee-1",
    email: "employee@company.com",
    password: hash("Employee123!"),
    role: "employee",
    firstName: "Hassan",
    lastName: "Ali",
    employeeCode: "EMP-101",
    department: "Engineering",
    designation: "Frontend Developer",
    status: "Active",
    joiningDate: "2024-02-10",
    salary: 180000,
    team: "Product",
    phoneNumber: "+92 300 0000003",
  },
];

export const demoUsers = [...baseUsers];

export const demoEmployees = [
  {
    id: "emp-1",
    employeeCode: "EMP-101",
    firstName: "Hassan",
    lastName: "Ali",
    email: "hassan.ali@company.com",
    department: "Engineering",
    designation: "Frontend Developer",
    status: "Active",
    joiningDate: "2024-02-10",
    salary: 180000,
  },
  {
    id: "emp-2",
    employeeCode: "EMP-102",
    firstName: "Areeba",
    lastName: "Naseem",
    email: "areeba.naseem@company.com",
    department: "Design",
    designation: "Product Designer",
    status: "Active",
    joiningDate: "2023-09-12",
    salary: 160000,
  },
  {
    id: "emp-3",
    employeeCode: "EMP-103",
    firstName: "Zain",
    lastName: "Ahmad",
    email: "zain.ahmad@company.com",
    department: "Finance",
    designation: "Senior Analyst",
    status: "On Leave",
    joiningDate: "2022-11-01",
    salary: 170000,
  },
  {
    id: "emp-4",
    employeeCode: "EMP-104",
    firstName: "Sana",
    lastName: "Iqbal",
    email: "sana.iqbal@company.com",
    department: "Operations",
    designation: "Operations Executive",
    status: "Active",
    joiningDate: "2024-06-27",
    salary: 150000,
  },
];

export const demoAttendance = [
  { employeeCode: "EMP-101", date: "2026-10-22", checkIn: "09:10", checkOut: "18:00", hours: 8.8 },
  { employeeCode: "EMP-102", date: "2026-10-22", checkIn: "08:55", checkOut: "17:50", hours: 8.9 },
  { employeeCode: "EMP-103", date: "2026-10-22", checkIn: "09:30", checkOut: "17:45", hours: 8.25 },
  { employeeCode: "EMP-104", date: "2026-10-22", checkIn: "09:25", checkOut: "17:40", hours: 8.25 },
];

export const demoLeaveRequests = [
  { id: "leave-1", employeeCode: "EMP-101", leaveType: "Annual", days: 4, status: "Pending", from: "2026-10-28", to: "2026-11-01" },
  { id: "leave-2", employeeCode: "EMP-103", leaveType: "Sick", days: 2, status: "Approved", from: "2026-10-18", to: "2026-10-19" },
  { id: "leave-3", employeeCode: "EMP-102", leaveType: "Casual", days: 3, status: "Approved", from: "2026-10-05", to: "2026-10-07" },
];

export const demoPayrolls = [
  { month: "2026-09", totalGross: 780000, totalNet: 699600, finalized: true },
  { month: "2026-10", totalGross: 796000, totalNet: 712350, finalized: false },
];

export const getDemoStore = () => ({
  users: demoUsers,
  employees: demoEmployees,
  attendance: demoAttendance,
  leaves: demoLeaveRequests,
  payrolls: demoPayrolls,
});
