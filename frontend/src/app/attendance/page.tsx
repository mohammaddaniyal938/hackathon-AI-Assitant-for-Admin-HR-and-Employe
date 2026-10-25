"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import axios from "axios";
import ProtectedRoute from "@/components/ProtectedRoute";
import HrAttendance from "@/components/HrAttendance";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

interface AttendanceRecord {
  _id: string;
  workDate: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  employee?: { firstName: string; lastName: string; email: string; employeeCode: string; department: string };
  corrections?: Array<{ _id: string; reason: string; status: string; requestedCheckIn?: string; requestedCheckOut?: string }>;
}

interface AttendanceOverview {
  date: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
  missingCheckout: number;
  pendingCorrections: number;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [reason, setReason] = useState("");
  const [correctionDate, setCorrectionDate] = useState("");
  const [requestedCheckIn, setRequestedCheckIn] = useState("");
  const [requestedCheckOut, setRequestedCheckOut] = useState("");

  const refresh = useCallback(async () => {
    if (!user || user.role === "hr") return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (department && user.role !== "employee") params.set("department", department);
      if (employeeId && user.role !== "employee") params.set("employeeId", employeeId);
      const [attendanceResult, overviewResult] = await Promise.all([
        api.get<{ attendance: AttendanceRecord[] }>(`/attendance?${params.toString()}`),
        user.role === "employee" ? Promise.resolve(null) : api.get<AttendanceOverview>("/attendance/overview"),
      ]);
      setRecords(attendanceResult.data.attendance);
      setOverview(overviewResult?.data || null);
    } catch (requestError) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 403) setError("You do not have permission to view this attendance information.");
      else if (!axios.isAxiosError(requestError) || requestError.response?.status !== 401) setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to load attendance." : "Unable to load attendance.");
    } finally {
      setLoading(false);
    }
  }, [user, from, to, department, employeeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const doAction = async (action: "check-in" | "check-out") => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post(`/attendance/${action}`);
      setSuccess(data.message);
      await refresh();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Attendance action failed." : "Attendance action failed.");
    } finally {
      setBusy(false);
    }
  };

  const submitCorrection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post("/attendance/corrections", {
        workDate: correctionDate,
        reason,
        requestedCheckIn: requestedCheckIn ? new Date(requestedCheckIn).toISOString() : undefined,
        requestedCheckOut: requestedCheckOut ? new Date(requestedCheckOut).toISOString() : undefined,
      });
      setSuccess(data.message);
      setReason("");
      setRequestedCheckIn("");
      setRequestedCheckOut("");
      await refresh();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to submit correction." : "Unable to submit correction.");
    } finally {
      setBusy(false);
    }
  };

  const reviewCorrection = async (correctionId: string, decision: "approved" | "rejected") => {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/attendance/corrections/${correctionId}`, { decision });
      setSuccess(`Correction ${decision}.`);
      await refresh();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to review correction." : "Unable to review correction.");
    } finally {
      setBusy(false);
    }
  };

  if (user?.role === "hr") {
    return <ProtectedRoute><HrAttendance /></ProtectedRoute>;
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5 shadow-sm">
            <div><Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">← Dashboard</Link><h1 className="mt-2 text-2xl font-bold">Attendance</h1><p className="mt-1 text-sm text-slate-500">Workday records and attendance requests</p></div>
            {user?.role === "employee" && <div className="flex gap-2"><button disabled={busy} onClick={() => void doAction("check-in")} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Check in</button><button disabled={busy} onClick={() => void doAction("check-out")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Check out</button></div>}
          </header>

          {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          {success && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

          {overview && <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{[
            ["Present", overview.present], ["Absent", overview.absent], ["Late", overview.late], ["Half-day", overview.halfDay], ["On leave", overview.onLeave], ["Missing checkout", overview.missingCheckout],
          ].map(([label, value]) => <article key={label} className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></article>)}</section>}

          {user?.role === "employee" && <form onSubmit={submitCorrection} className="mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium">Correction date<input required type="date" value={correctionDate} onChange={(event) => setCorrectionDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-medium">Requested check-in<input type="datetime-local" value={requestedCheckIn} onChange={(event) => setRequestedCheckIn(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-medium">Requested check-out<input type="datetime-local" value={requestedCheckOut} onChange={(event) => setRequestedCheckOut(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-medium">Reason<input required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the missed or incorrect attendance record" className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            <button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-4">Request correction</button>
          </form>}

          <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-bold">{user?.role === "employee" ? "My attendance" : "Attendance history"}</h2>
            <div className="flex flex-wrap gap-2">
              {user?.role !== "employee" && <><label className="text-xs text-slate-500">Department<input aria-label="Filter attendance by department" value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="All departments" className="mt-1 block w-36 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label><label className="text-xs text-slate-500">Employee ID, code, or email<input aria-label="Filter attendance by employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="All employees" className="mt-1 block w-44 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label></>}
              <label className="text-xs text-slate-500">From<input aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
              <label className="text-xs text-slate-500">To<input aria-label="To date" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
            </div>
            </div>
            {loading ? <div className="h-48 animate-pulse rounded-xl bg-slate-100" /> : records.length === 0 ? <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No attendance records for this date range.</div> : (
              <div className="overflow-x-auto"><table className="min-w-[700px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Check in</th><th className="px-4 py-3">Check out</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Corrections</th></tr></thead><tbody>{records.map((record) => <tr key={record._id} className="border-t border-slate-100"><td className="px-4 py-3">{record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : "You"}</td><td className="px-4 py-3">{record.workDate}</td><td className="px-4 py-3">{record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td className="px-4 py-3">{record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Missing"}</td><td className="px-4 py-3 capitalize">{record.status}</td><td className="px-4 py-3">{record.corrections?.map((correction) => <div key={correction._id} className="mb-1 flex flex-wrap items-center gap-1"><span className="text-xs" title={correction.reason}>{correction.status}: {correction.reason}</span>{user?.role !== "employee" && correction.status === "pending" && <><button disabled={busy} onClick={() => void reviewCorrection(correction._id, "approved")} className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Approve</button><button disabled={busy} onClick={() => void reviewCorrection(correction._id, "rejected")} className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">Reject</button></>}</div>) || "—"}</td></tr>)}</tbody></table></div>
            )}
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}
