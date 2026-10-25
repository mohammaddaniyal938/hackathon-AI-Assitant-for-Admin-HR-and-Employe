"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import axios from "axios";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

interface OrgSettings {
  organizationName: string;
  timezone: string;
  officeStart: string;
  gracePeriodMinutes: number;
  weekendDays: number[];
  holidays: string[];
  departments: string[];
  designations: string[];
  leaveQuotas: { annual: number; sick: number; casual: number };
  payroll: { hraRate: number; medicalRate: number; grossMultiplier: number };
}

interface AuditRecord {
  _id: string;
  action: string;
  entity: string;
  createdAt: string;
  actor?: { firstName: string; lastName: string; email: string };
}

const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [holidayInput, setHolidayInput] = useState("");
  const [departmentInput, setDepartmentInput] = useState("");
  const [designationInput, setDesignationInput] = useState("");
  const isAdmin = user?.role === "admin";

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const requests = await Promise.all([
        api.get<{ settings: OrgSettings }>("/settings"),
        user?.role === "admin" ? api.get<{ logs: AuditRecord[] }>("/settings/audit?limit=10") : Promise.resolve(null),
      ]);
      setSettings(requests[0].data.settings);
      if (requests[1]) setLogs(requests[1].data.logs);
      setError("");
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to load organization settings." : "Unable to load organization settings.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => { void loadSettings(); }, 0);
    return () => window.clearTimeout(timer);
  }, [user, loadSettings]);

  const update = <K extends keyof OrgSettings>(field: K, value: OrgSettings[K]) => {
    setSettings((current) => current ? { ...current, [field]: value } : current);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.put<{ settings: OrgSettings }>("/settings", {
        ...settings,
        holidays: settings.holidays.map((date) => date.slice(0, 10)),
      });
      setSettings(data.settings);
      setSuccess("Organization settings saved.");
      await loadSettings();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to save settings." : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const addHoliday = () => {
    if (!settings || !holidayInput || settings.holidays.some((day) => day.slice(0, 10) === holidayInput)) return;
    update("holidays", [...settings.holidays, holidayInput].sort());
    setHolidayInput("");
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6 rounded-3xl bg-white p-5 shadow-sm"><Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">← Dashboard</Link><h1 className="mt-2 text-2xl font-bold">Organization settings</h1><p className="mt-1 text-sm text-slate-500">Work schedule, leave quotas, and payroll assumptions</p></header>
          {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          {success && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}
          {loading || !settings ? <div className="h-64 animate-pulse rounded-3xl bg-white" /> : (
            <form onSubmit={save} className="space-y-6">
              <section className="grid gap-4 rounded-3xl bg-white p-5 shadow-sm sm:grid-cols-2">
                <h2 className="text-lg font-bold sm:col-span-2">Organization and work schedule</h2>
                <label className="text-sm font-medium">Organization name<input disabled={!isAdmin} value={settings.organizationName} onChange={(event) => update("organizationName", event.target.value)} required maxLength={120} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 disabled:bg-slate-50" /></label>
                <label className="text-sm font-medium">Timezone (IANA)<input disabled={!isAdmin} value={settings.timezone} onChange={(event) => update("timezone", event.target.value)} required placeholder="UTC" className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 disabled:bg-slate-50" /></label>
                <label className="text-sm font-medium">Office starts<input disabled={!isAdmin} type="time" value={settings.officeStart} onChange={(event) => update("officeStart", event.target.value)} required className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 disabled:bg-slate-50" /></label>
                <label className="text-sm font-medium">Grace period in minutes<input disabled={!isAdmin} type="number" min="0" max="240" value={settings.gracePeriodMinutes} onChange={(event) => update("gracePeriodMinutes", Number(event.target.value))} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 disabled:bg-slate-50" /></label>
                <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium">Weekly holidays</legend><div className="flex flex-wrap gap-3">{weekDays.map((day, index) => <label key={day} className="flex items-center gap-2 text-sm"><input disabled={!isAdmin} type="checkbox" checked={settings.weekendDays.includes(index)} onChange={(event) => update("weekendDays", event.target.checked ? [...settings.weekendDays, index].sort() : settings.weekendDays.filter((value) => value !== index))} />{day}</label>)}</div></fieldset>
                <div className="sm:col-span-2"><p className="text-sm font-medium">Public holidays</p><div className="mt-2 flex flex-wrap items-center gap-2">{settings.holidays.map((holiday) => <span key={holiday} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm">{holiday.slice(0, 10)}{isAdmin && <button type="button" aria-label={`Remove holiday ${holiday}`} onClick={() => update("holidays", settings.holidays.filter((date) => date !== holiday))} className="font-bold text-red-600">×</button>}</span>)}</div>{isAdmin && <div className="mt-3 flex gap-2"><input type="date" value={holidayInput} onChange={(event) => setHolidayInput(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2" /><button type="button" onClick={addHoliday} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Add holiday</button></div>}</div>
              </section>
              <section className="grid gap-5 rounded-3xl bg-white p-5 shadow-sm sm:grid-cols-2">
                <h2 className="text-lg font-bold sm:col-span-2">Departments and designations</h2>
                {(["departments", "designations"] as const).map((field) => {
                  const isDepartments = field === "departments";
                  const input = isDepartments ? departmentInput : designationInput;
                  const setInput = isDepartments ? setDepartmentInput : setDesignationInput;
                  const title = isDepartments ? "Departments" : "Designations";
                  return <div key={field}><h3 className="text-sm font-semibold">{title}</h3><div className="mt-2 flex flex-wrap gap-2">{settings[field].map((item) => <span key={item} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm">{item}{isAdmin && <button type="button" aria-label={`Remove ${item}`} onClick={() => update(field, settings[field].filter((value) => value !== item))} className="font-bold text-red-600">×</button>}</span>)}</div>{isAdmin && <div className="mt-3 flex gap-2"><input maxLength={100} value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Add ${isDepartments ? "department" : "designation"}`} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2" /><button type="button" onClick={() => { const name = input.trim(); if (name && !settings[field].some((value) => value.toLowerCase() === name.toLowerCase())) update(field, [...settings[field], name]); setInput(""); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Add</button></div>}</div>;
                })}
                <p className="text-xs text-slate-500 sm:col-span-2">These lists are maintained for organization reference. Employee profiles still retain their existing department and designation values.</p>
              </section>
              <section className="grid gap-4 rounded-3xl bg-white p-5 shadow-sm sm:grid-cols-3">
                <h2 className="text-lg font-bold sm:col-span-3">Annual leave quotas (working days)</h2>
                {(["annual", "sick", "casual"] as const).map((leaveType) => <label key={leaveType} className="text-sm font-medium capitalize">{leaveType}<input disabled={!isAdmin} type="number" min="0" max="365" value={settings.leaveQuotas[leaveType]} onChange={(event) => update("leaveQuotas", { ...settings.leaveQuotas, [leaveType]: Number(event.target.value) })} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 disabled:bg-slate-50" /></label>)}
              </section>
              <section className="grid gap-4 rounded-3xl bg-white p-5 shadow-sm sm:grid-cols-3">
                <h2 className="text-lg font-bold sm:col-span-3">Payroll assumptions</h2>
                {([["hraRate", "Housing allowance rate"], ["medicalRate", "Medical allowance rate"], ["grossMultiplier", "Gross salary multiplier"]] as const).map(([key, label]) => <label key={key} className="text-sm font-medium">{label}<input disabled={!isAdmin} type="number" min="0" max="10" step="0.01" value={settings.payroll[key]} onChange={(event) => update("payroll", { ...settings.payroll, [key]: Number(event.target.value) })} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 disabled:bg-slate-50" /></label>)}
                <p className="text-xs text-slate-500 sm:col-span-3">These are configurable illustrative salary components. Tax and statutory deductions are not calculated.</p>
              </section>
              {isAdmin && <button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save settings"}</button>}
            </form>
          )}
          {isAdmin && <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Recent audit events</h2>{logs.length ? <ul className="mt-4 divide-y divide-slate-100">{logs.map((log) => <li key={log._id} className="py-3"><p className="font-medium">{log.action}</p><p className="text-sm text-slate-500">{log.actor?.email || "System"} · {new Date(log.createdAt).toLocaleString()} · {log.entity}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No audit events.</p>}</section>}
        </div>
      </main>
    </ProtectedRoute>
  );
}
