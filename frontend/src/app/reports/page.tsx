"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

interface DepartmentCount { name: string; value: number }
interface DashboardReport { departmentBreakdown: DepartmentCount[]; kpis: Array<{ label: string; value: string }> }
interface AttendanceOverview { total: number; present: number; absent: number; late: number; halfDay: number; onLeave: number; missingCheckout: number }
interface AttendanceTrend { date: string; records: number; present: number; late: number; halfDay: number }
interface LeaveRow { leaveType: string; status: string; workingDays: number; employee?: { department?: string } }
interface PayrollRun { period: string; status: string; entries: Array<unknown>; totalGross: number; totalNet: number }

const dateKeyInZone = (date: Date, timezone: string) => {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export default function ReportsPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardReport | null>(null);
  const [attendance, setAttendance] = useState<AttendanceOverview | null>(null);
  const [attendanceTrends, setAttendanceTrends] = useState<AttendanceTrend[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    if (!user) return;
    if (user.role === "employee") {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: settingsData } = await api.get<{ settings: { timezone: string } }>("/settings");
      const timezone = settingsData.settings.timezone || "UTC";
      const to = dateKeyInZone(new Date(), timezone);
      const fromDate = new Date(`${to}T12:00:00.000Z`);
      fromDate.setUTCDate(fromDate.getUTCDate() - 6);
      const from = fromDate.toISOString().slice(0, 10);
      const [dashboardResult, attendanceResult, historyResult, leaveResult, payrollResult] = await Promise.all([
        api.get<DashboardReport>("/dashboard/summary"),
        api.get<AttendanceOverview>("/attendance/overview"),
        api.get<{ trends: AttendanceTrend[] }>(`/attendance/trends?from=${from}&to=${to}`),
        api.get<{ leaves: LeaveRow[] }>("/leaves"),
        api.get<{ payrollRuns: PayrollRun[] }>("/payroll"),
      ]);
      setDashboard(dashboardResult.data);
      setAttendance(attendanceResult.data);
      setAttendanceTrends(historyResult.data.trends);
      setLeaves(leaveResult.data.leaves);
      setPayrollRuns(payrollResult.data.payrollRuns);
      setError("");
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to load reports." : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReports(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  const exportReport = () => {
    if (!dashboard || !attendance) return;
    const rows = [
      ["Report", "Metric", "Value"],
      ...dashboard.kpis.map((item) => ["Organization", item.label, item.value]),
      ["Attendance today", "Present", String(attendance.present)],
      ["Attendance today", "Absent", String(attendance.absent)],
      ["Attendance today", "Late", String(attendance.late)],
      ["Attendance today", "Half-day", String(attendance.halfDay)],
      ...Object.entries(leaveCounts).map(([status, count]) => ["Leave requests", status, String(count)]),
      ...payrollRuns.map((run) => [`Payroll ${run.period}`, `Total gross (${run.status})`, String(run.totalGross)]),
    ];
    const csv = rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "hcm-reports.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const leaveCounts = leaves.reduce<Record<string, number>>((counts, leave) => {
    counts[leave.status] = (counts[leave.status] || 0) + 1;
    return counts;
  }, {});
  const maxHeadcount = Math.max(1, ...(dashboard?.departmentBreakdown || []).map((department) => department.value));
  const maxAttendance = Math.max(1, ...attendanceTrends.map((day) => day.records));

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5 shadow-sm"><div><Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">← Dashboard</Link><h1 className="mt-2 text-2xl font-bold">Reports & analytics</h1><p className="mt-1 text-sm text-slate-500">Live reports aggregated from persisted employee and HR records</p></div><button type="button" onClick={exportReport} disabled={!dashboard || !attendance} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Export CSV</button></header>
          {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          {loading ? <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-3xl bg-white" />)}</div> : user?.role === "employee" ? <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">Reports are available to Admin and HR only.</p> : (
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Headcount by department</h2>{dashboard?.departmentBreakdown.length ? <div className="mt-5 space-y-4">{dashboard.departmentBreakdown.map((item) => <div key={item.name}><div className="mb-1 flex justify-between text-sm"><span>{item.name}</span><b>{item.value}</b></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${item.value / maxHeadcount * 100}%` }} /></div></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No employee headcount data.</p>}</section>
              <section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Attendance snapshot · today</h2>{attendance && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Present", attendance.present], ["Absent", attendance.absent], ["Late", attendance.late], ["Half-day", attendance.halfDay], ["On leave", attendance.onLeave], ["Missing checkout", attendance.missingCheckout]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>}</section>
              <section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Attendance records · last 7 calendar days</h2>{attendanceTrends.length ? <div className="mt-5 flex h-44 items-end gap-2">{attendanceTrends.map((day) => <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-xs font-semibold">{day.records}</span><div title={`${day.date}: ${day.records} records; ${day.present} present`} className="w-full rounded-t-lg bg-indigo-500" style={{ height: `${Math.max(8, day.records / maxAttendance * 120)}px` }} /><span className="text-[10px] text-slate-500">{day.date.slice(5)}</span></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No attendance records in the selected period.</p>}</section>
              <section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Leave requests by status</h2>{Object.keys(leaveCounts).length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(leaveCounts).map(([status, count]) => <div key={status} className="rounded-xl bg-slate-50 p-3"><p className="text-xs capitalize text-slate-500">{status}</p><p className="mt-1 text-xl font-bold">{count}</p></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No leave requests recorded.</p>}</section>
              <section className="rounded-3xl bg-white p-5 shadow-sm xl:col-span-2"><h2 className="text-lg font-bold">Payroll periods</h2>{payrollRuns.length ? <div className="mt-4 overflow-x-auto"><table className="min-w-[600px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Period</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Employees</th><th className="px-3 py-2">Gross</th><th className="px-3 py-2">Net</th></tr></thead><tbody>{payrollRuns.map((run) => <tr key={run.period} className="border-t border-slate-100"><td className="px-3 py-2">{run.period}</td><td className="px-3 py-2 capitalize">{run.status}</td><td className="px-3 py-2">{run.entries.length}</td><td className="px-3 py-2">{run.totalGross.toLocaleString()}</td><td className="px-3 py-2">{run.totalNet.toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-slate-500">No payroll periods have been created.</p>}</section>
              <p className="text-xs text-slate-500 xl:col-span-2">Reports show actual records returned by the backend. Attendance bars count existing records, not inferred daily presence. No AI-generated conclusions are included.</p>
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
