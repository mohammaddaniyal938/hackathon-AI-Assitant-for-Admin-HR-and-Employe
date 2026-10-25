"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import api from "@/lib/api";

interface AttendanceRecord {
  _id: string;
  workDate: string;
  checkIn: string | null;
  checkOut: string | null;
  status: "present" | "late" | "half-day" | "absent" | "on-leave";
  workingHours: number;
}

interface AttendanceData {
  timezone: string;
  workDate: string;
  todayStatus: "not-checked-in" | "checked-in" | "checked-out";
  canCheckIn: boolean;
  checkInUnavailableReason: string;
  today: AttendanceRecord | null;
  monthlySummary: {
    workingDays: number;
    present: number;
    late: number;
    halfDay: number;
    absent: number;
    onLeave: number;
    workingHours: number;
  };
  attendance: AttendanceRecord[];
}

const statusLabels: Record<AttendanceRecord["status"], string> = {
  present: "Present",
  late: "Late",
  "half-day": "Half day",
  absent: "Absent",
  "on-leave": "On leave",
};

const statusStyles: Record<AttendanceRecord["status"], string> = {
  present: "bg-emerald-100 text-emerald-800",
  late: "bg-amber-100 text-amber-800",
  "half-day": "bg-orange-100 text-orange-800",
  absent: "bg-red-100 text-red-800",
  "on-leave": "bg-blue-100 text-blue-800",
};

export default function HrAttendance() {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [month, setMonth] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (status) params.set("status", status);
      const response = await api.get<AttendanceData>(`/attendance/self?${params.toString()}`);
      setData(response.data);
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        setError(requestError.response?.data?.message || "Unable to load your attendance. Please try again.");
      } else {
        setError("Unable to load your attendance. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [month, from, to, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const recordAttendance = async (action: "check-in" | "check-out") => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await api.post<{ message: string }>(`/attendance/self/${action}`);
      setSuccess(response.data.message);
      await refresh();
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        setError(requestError.response?.data?.message || "Unable to record attendance. Please try again.");
      } else {
        setError("Unable to record attendance. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const formatTime = (value: string | null) => value && data
    ? new Intl.DateTimeFormat(undefined, { timeZone: data.timezone, hour: "numeric", minute: "2-digit" }).format(new Date(value))
    : "—";

  const currentHours = data?.today?.checkIn
    ? data.today.checkOut
      ? data.today.workingHours
      : now
        ? Math.max(0, Math.round(((now - new Date(data.today.checkIn).getTime()) / 3600000) * 100) / 100)
        : 0
    : 0;

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5 shadow-sm">
          <div>
            <Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">← Dashboard</Link>
            <h1 className="mt-2 text-2xl font-bold">My attendance</h1>
            <p className="mt-1 text-sm text-slate-500">Record your workday and review your personal attendance history.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data?.todayStatus === "not-checked-in" && (data.canCheckIn
              ? <button type="button" disabled={busy || loading} onClick={() => void recordAttendance("check-in")} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? "Recording..." : "Check in"}</button>
              : <span title={data.checkInUnavailableReason} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500">{data.checkInUnavailableReason || "Check-in unavailable today"}</span>)}
            {data?.todayStatus === "checked-in" && <button type="button" disabled={busy || loading} onClick={() => void recordAttendance("check-out")} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busy ? "Recording..." : "Check out"}</button>}
            {data?.todayStatus === "checked-out" && <span className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800">Day completed</span>}
          </div>
        </header>

        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {success && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

        {loading && !data ? (
          <div aria-label="Loading attendance" className="space-y-4">
            <div className="h-36 animate-pulse rounded-3xl bg-white" />
            <div className="h-24 animate-pulse rounded-3xl bg-white" />
            <div className="h-64 animate-pulse rounded-3xl bg-white" />
          </div>
        ) : data ? (
          <>
            <section aria-label="Today's attendance" className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="text-lg font-bold">Today</h2><p className="text-sm text-slate-500">{data.workDate} · {data.timezone}</p></div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${data.todayStatus === "checked-out" ? "bg-emerald-100 text-emerald-800" : data.todayStatus === "checked-in" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}>
                  {data.todayStatus === "checked-out" ? "Checked Out" : data.todayStatus === "checked-in" ? "Checked In" : "Not Checked In"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div><p className="text-xs text-slate-500">Check-in</p><p className="mt-1 font-semibold">{formatTime(data.today?.checkIn || null)}</p></div>
                <div><p className="text-xs text-slate-500">Check-out</p><p className="mt-1 font-semibold">{formatTime(data.today?.checkOut || null)}</p></div>
                <div><p className="text-xs text-slate-500">Working hours</p><p className="mt-1 font-semibold">{currentHours.toFixed(2)}{data.todayStatus === "checked-in" ? " · in progress" : ""}</p></div>
              </div>
            </section>

            <section aria-label="Monthly attendance summary" className="mb-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">Monthly summary</h2>
                <span className="text-sm text-slate-500">{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: data.timezone }).format(new Date(`${data.workDate}T12:00:00Z`))} · {data.monthlySummary.workingDays} scheduled workdays</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Present", data.monthlySummary.present],
                  ["Late", data.monthlySummary.late],
                  ["Half day", data.monthlySummary.halfDay],
                  ["Absent", data.monthlySummary.absent],
                  ["On leave", data.monthlySummary.onLeave],
                  ["Working hours", `${data.monthlySummary.workingHours.toFixed(2)} h`],
                ].map(([label, value]) => <article key={label} className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></article>)}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div><h2 className="text-lg font-bold">Attendance history</h2><p className="text-sm text-slate-500">Times are shown in the organization timezone.</p></div>
                <div className="flex flex-wrap gap-2">
                  <label className="text-xs text-slate-500">Month<input aria-label="Filter by month" type="month" value={month} onChange={(event) => { setMonth(event.target.value); setFrom(""); setTo(""); }} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900" /></label>
                  <label className="text-xs text-slate-500">From<input aria-label="Filter from date" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setMonth(""); }} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900" /></label>
                  <label className="text-xs text-slate-500">To<input aria-label="Filter to date" type="date" value={to} onChange={(event) => { setTo(event.target.value); setMonth(""); }} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900" /></label>
                  <label className="text-xs text-slate-500">Status<select aria-label="Filter by attendance status" value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"><option value="">All statuses</option><option value="present">Present</option><option value="late">Late</option><option value="half-day">Half day</option><option value="absent">Absent</option><option value="on-leave">On leave</option></select></label>
                </div>
              </div>
              {loading ? <div className="h-48 animate-pulse rounded-xl bg-slate-100" /> : data.attendance.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No attendance history matches these filters.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Check-in</th><th className="px-4 py-3">Check-out</th><th className="px-4 py-3">Hours</th><th className="px-4 py-3">Status</th></tr></thead>
                    <tbody>{data.attendance.map((record) => <tr key={record._id} className="border-t border-slate-100">
                      <td className="px-4 py-3">{record.workDate}</td>
                      <td className="px-4 py-3">{formatTime(record.checkIn)}</td>
                      <td className="px-4 py-3">{formatTime(record.checkOut)}</td>
                      <td className="px-4 py-3">{record.workingHours.toFixed(2)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[record.status]}`}>{statusLabels[record.status]}</span></td>
                    </tr>)}</tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Attendance could not be loaded.</div>}
      </div>
    </main>
  );
}
