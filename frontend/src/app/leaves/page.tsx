"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import axios from "axios";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

interface Leave {
  _id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  reason: string;
  status: string;
  reviewComment?: string;
  employee?: { firstName: string; lastName: string; employeeCode: string };
}

interface LeaveBalance {
  [type: string]: { quota: number | null; used: number; remaining: number | null };
}

export default function LeavesPage() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [balance, setBalance] = useState<LeaveBalance>({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ leaveType: "annual", startDate: "", endDate: "", reason: "" });

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const [leaveResult, balanceResult] = await Promise.all([
        api.get<{ leaves: Leave[] }>(`/leaves?${params.toString()}`),
        user.role === "employee" ? api.get<{ balance: LeaveBalance }>("/leaves/balance") : Promise.resolve(null),
      ]);
      setLeaves(leaveResult.data.leaves);
      if (balanceResult) setBalance(balanceResult.data.balance);
      setError("");
    } catch (requestError) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 403) setError("You do not have permission to view these leave requests.");
      else if (!axios.isAxiosError(requestError) || requestError.response?.status !== 401) setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to load leave requests." : "Unable to load leave requests.");
    } finally {
      setLoading(false);
    }
  }, [user, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const submitLeave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyId("submit");
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post("/leaves", form);
      setSuccess(data.message);
      setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
      await refresh();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to submit leave request." : "Unable to submit leave request.");
    } finally {
      setBusyId("");
    }
  };

  const decide = async (leaveId: string, decision: "approved" | "rejected") => {
    setBusyId(leaveId);
    setError("");
    try {
      const { data } = await api.patch(`/leaves/${leaveId}/review`, { decision });
      setSuccess(data.message);
      await refresh();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to review request." : "Unable to review request.");
    } finally {
      setBusyId("");
    }
  };

  const cancel = async (leaveId: string) => {
    setBusyId(leaveId);
    setError("");
    try {
      const { data } = await api.patch(`/leaves/${leaveId}/cancel`);
      setSuccess(data.message);
      await refresh();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to cancel request." : "Unable to cancel request.");
    } finally {
      setBusyId("");
    }
  };

  const isEmployee = user?.role === "employee";
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 rounded-3xl bg-white p-5 shadow-sm"><Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">← Dashboard</Link><h1 className="mt-2 text-2xl font-bold">Leave management</h1><p className="mt-1 text-sm text-slate-500">Requests, balances, and approvals</p></header>
          {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          {success && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

          {isEmployee && <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(balance).map(([type, item]) => <article key={type} className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs capitalize text-slate-500">{type} leave</p><p className="mt-1 text-xl font-bold">{item.remaining === null ? "—" : `${item.remaining} days`}</p><p className="text-xs text-slate-500">{item.used} used {item.quota === null ? "" : `of ${item.quota}`}</p></article>)}</section>}

          {isEmployee && <form onSubmit={submitLeave} className="mb-6 grid gap-4 rounded-3xl bg-white p-5 shadow-sm md:grid-cols-2">
            <h2 className="text-lg font-bold md:col-span-2">Apply for leave</h2>
            <label className="text-sm font-medium">Leave type<select value={form.leaveType} onChange={(event) => setForm((current) => ({ ...current, leaveType: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="annual">Annual</option><option value="sick">Sick</option><option value="casual">Casual</option><option value="unpaid">Unpaid</option></select></label>
            <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Start date<input required type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label><label className="text-sm font-medium">End date<input required min={form.startDate || undefined} type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label></div>
            <label className="text-sm font-medium md:col-span-2">Reason<textarea required maxLength={2000} rows={3} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
            <div className="md:col-span-2"><button disabled={busyId === "submit"} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyId === "submit" ? "Submitting..." : "Submit request"}</button></div>
          </form>}

          <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{isEmployee ? "My leave requests" : "Leave requests and approvals"}</h2><select aria-label="Filter leave status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">All statuses</option>{["pending", "approved", "rejected", "cancelled"].map((value) => <option key={value}>{value}</option>)}</select></div>
            {loading ? <div className="h-44 animate-pulse rounded-xl bg-slate-100" /> : leaves.length === 0 ? <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No leave requests to show.</div> : (
              <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{!isEmployee && <th className="px-4 py-3">Employee</th>}<th className="px-4 py-3">Type</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Working days</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{leaves.map((leave) => <tr key={leave._id} className="border-t border-slate-100">{!isEmployee && <td className="px-4 py-3">{leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName}` : "Employee"}</td>}<td className="px-4 py-3 capitalize">{leave.leaveType}</td><td className="px-4 py-3">{new Date(leave.startDate).toLocaleDateString()} – {new Date(leave.endDate).toLocaleDateString()}</td><td className="px-4 py-3">{leave.workingDays}</td><td className="max-w-56 px-4 py-3">{leave.reason}</td><td className="px-4 py-3 capitalize">{leave.status}</td><td className="px-4 py-3"><div className="flex gap-2">{isEmployee && leave.status === "pending" && <button disabled={busyId === leave._id} onClick={() => void cancel(leave._id)} className="rounded bg-slate-100 px-2 py-1 text-xs">Cancel</button>}{!isEmployee && leave.status === "pending" && <><button disabled={busyId === leave._id} onClick={() => void decide(leave._id, "approved")} className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Approve</button><button disabled={busyId === leave._id} onClick={() => void decide(leave._id, "rejected")} className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">Reject</button></>}</div></td></tr>)}</tbody></table></div>
            )}
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}
