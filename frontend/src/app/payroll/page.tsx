"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import axios from "axios";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

interface PayrollEntry {
  employeeCode: string;
  employeeName: string;
  basicSalary: number;
  hra: number;
  medicalAllowance: number;
  grossSalary: number;
  absentDays: number;
  halfDays: number;
  unpaidLeaveDays: number;
  deductions: number;
  netSalary: number;
}

interface PayrollRun {
  _id: string;
  period: string;
  status: string;
  entries: PayrollEntry[];
  totalGross: number;
  totalNet: number;
}

interface Payslip extends PayrollEntry {
  period: string;
}

const money = (value: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value || 0);

export default function PayrollPage() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [period, setPeriod] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isEmployee = user?.role === "employee";
  const isAdmin = user?.role === "admin";

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (user.role === "employee") {
        const { data } = await api.get<{ payslips: Payslip[] }>("/payroll/my");
        setPayslips(data.payslips);
      } else {
        const { data } = await api.get<{ payrollRuns: PayrollRun[] }>("/payroll");
        setRuns(data.payrollRuns);
      }
      setError("");
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to load payroll information." : "Unable to load payroll information.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const createDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("create");
    setError("");
    try {
      await api.post("/payroll", { period });
      setSuccess("Payroll draft created from configured salary, attendance, and approved leave records.");
      await refresh();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to create payroll draft." : "Unable to create payroll draft.");
    } finally {
      setBusy("");
    }
  };

  const transition = async (runId: string, action: "review" | "finalize" | "lock") => {
    setBusy(runId);
    setError("");
    try {
      await api.patch(`/payroll/${runId}/${action}`);
      setSuccess(action === "review" ? "Payroll reviewed." : action === "finalize" ? "Payroll finalized. Employee payslips are now available." : "Payroll locked against further changes.");
      await refresh();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to update payroll status." : "Unable to update payroll status.");
    } finally {
      setBusy("");
    }
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 rounded-3xl bg-white p-5 shadow-sm"><Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">← Dashboard</Link><h1 className="mt-2 text-2xl font-bold">Payroll</h1><p className="mt-1 text-sm text-slate-500">Configured payroll calculations and finalized payslips</p></header>
          {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          {success && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

          {isEmployee ? (
            <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5"><h2 className="mb-4 text-lg font-bold">My finalized payslips</h2>{loading ? <div className="h-40 animate-pulse rounded-xl bg-slate-100" /> : payslips.length === 0 ? <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No finalized payslips are available.</p> : <div className="space-y-4">{payslips.map((slip) => <article key={slip.period} className="rounded-2xl border border-slate-200 p-4 print:border-0"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Payslip · {slip.period}</h3><p className="text-sm text-slate-500">{slip.employeeName} · {slip.employeeCode}</p></div><button onClick={() => window.print()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold print:hidden">Print / Save as PDF</button></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><dt className="text-slate-500">Basic</dt><dd className="font-semibold">{money(slip.basicSalary)}</dd></div><div><dt className="text-slate-500">Allowances</dt><dd className="font-semibold">{money(slip.hra + slip.medicalAllowance)}</dd></div><div><dt className="text-slate-500">Gross</dt><dd className="font-semibold">{money(slip.grossSalary)}</dd></div><div><dt className="text-slate-500">Deductions</dt><dd className="font-semibold">{money(slip.deductions)}</dd></div><div className="col-span-2 border-t border-slate-100 pt-3 sm:col-span-4"><dt className="text-slate-500">Net pay</dt><dd className="text-xl font-bold text-emerald-700">{money(slip.netSalary)}</dd></div></dl><p className="mt-3 text-xs text-slate-500">No tax or statutory deductions are calculated unless configured by your organization.</p></article>)}</div>}</section>
          ) : (
            <>
              {(isAdmin || user?.role === "hr") && <form onSubmit={createDraft} className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm"><label className="text-sm font-medium">Closed payroll period<input required type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" /></label><button disabled={busy === "create"} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "create" ? "Creating..." : "Create draft"}</button><p className="basis-full text-xs text-slate-500">Calculations use salary and the current payroll settings; tax/statutory deductions are not invented. Finalization is Admin-only.</p></form>}
              <section className="space-y-4">{loading ? <div className="h-40 animate-pulse rounded-2xl bg-white" /> : runs.length === 0 ? <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500">No payroll runs have been created.</div> : runs.map((run) => <article key={run._id} className="rounded-3xl bg-white p-4 shadow-sm md:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{run.period} payroll</h2><p className="text-sm capitalize text-slate-500">Status: {run.status} · {run.entries.length} employees</p></div><div className="flex flex-wrap gap-2">{run.status === "draft" && <button disabled={busy === run._id} onClick={() => void transition(run._id, "review")} className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">Mark reviewed</button>}{isAdmin && run.status === "reviewed" && <button disabled={busy === run._id} onClick={() => void transition(run._id, "finalize")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Finalize payroll</button>}{isAdmin && run.status === "finalized" && <button disabled={busy === run._id} onClick={() => void transition(run._id, "lock")} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Lock payroll</button>}</div></div><div className="mt-4 flex gap-6 border-y border-slate-100 py-3 text-sm"><p>Total gross <b>{money(run.totalGross)}</b></p><p>Total net <b>{money(run.totalNet)}</b></p></div><div className="mt-4 overflow-x-auto"><table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Basic</th><th className="px-3 py-2">Allowances</th><th className="px-3 py-2">Gross</th><th className="px-3 py-2">Absent/half days</th><th className="px-3 py-2">Deductions</th><th className="px-3 py-2">Net</th></tr></thead><tbody>{run.entries.map((entry) => <tr key={entry.employeeCode} className="border-t border-slate-100"><td className="px-3 py-2">{entry.employeeName}<span className="ml-2 text-xs text-slate-500">{entry.employeeCode}</span></td><td className="px-3 py-2">{money(entry.basicSalary)}</td><td className="px-3 py-2">{money(entry.hra + entry.medicalAllowance)}</td><td className="px-3 py-2">{money(entry.grossSalary)}</td><td className="px-3 py-2">{entry.absentDays}/{entry.halfDays}</td><td className="px-3 py-2">{money(entry.deductions)}</td><td className="px-3 py-2 font-semibold">{money(entry.netSalary)}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-slate-500">No tax/statutory deductions included. Payroll data is restricted by backend role and ownership checks.</p></article>)}</section>
            </>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
