"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  designation: string;
  status: string;
  joiningDate: string | null;
  salary?: number;
  phoneNumber?: string;
  location?: string;
  employmentType?: string;
  manager?: string;
}
interface Attendance { workDate: string; status: string; checkIn?: string; checkOut?: string }
interface Leave { leaveType: string; startDate: string; endDate: string; workingDays: number; status: string }

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [form, setForm] = useState<Partial<Employee>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isAdmin = user?.role === "admin";
  const isEmployee = user?.role === "employee";

  const load = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    try {
      const [{ data: profile }, { data: attendanceData }, { data: leaveData }] = await Promise.all([
        api.get<{ employee: Employee }>(`/employees/${params.id}`),
        api.get<{ attendance: Attendance[] }>(`/attendance?employeeId=${params.id}`),
        api.get<{ leaves: Leave[] }>(`/leaves?employeeId=${params.id}`),
      ]);
      setEmployee(profile.employee);
      setForm(profile.employee);
      setAttendance(attendanceData.attendance.slice(0, 10));
      setLeaves(leaveData.leaves.slice(0, 10));
      setError("");
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to load employee profile." : "Unable to load employee profile.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const allowedFields = isEmployee ? ["phoneNumber", "location"] : ["firstName", "lastName", "email", "employeeCode", "department", "designation", "joiningDate", "salary", "phoneNumber", "location", "employmentType", "manager"];
      const updates = Object.fromEntries(allowedFields.map((field) => [field, form[field as keyof Employee]]).filter(([, value]) => value !== undefined));
      const { data } = await api.patch<{ employee: Employee }>(`/employees/${params.id}`, updates);
      setEmployee(data.employee);
      setForm(data.employee);
      setEditing(false);
      setSuccess("Employee profile updated.");
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to update employee." : "Unable to update employee.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!employee) return;
    const nextStatus = employee.status === "Active" ? "Inactive" : "Active";
    if (!window.confirm(`${nextStatus === "Inactive" ? "Deactivate" : "Reactivate"} ${employee.firstName} ${employee.lastName}?`)) return;
    try {
      const { data } = await api.patch<{ employee: Employee }>(`/employees/${params.id}/status`, { status: nextStatus });
      setEmployee(data.employee);
      setForm(data.employee);
      setSuccess(`Employee ${nextStatus.toLowerCase()}.`);
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to update employee status." : "Unable to update employee status.");
    }
  };

  const setField = (field: keyof Employee, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const fields: Array<[keyof Employee, string, string]> = isEmployee
    ? [["phoneNumber", "Phone", "tel"], ["location", "Location", "text"]]
    : [["firstName", "First name", "text"], ["lastName", "Last name", "text"], ["email", "Work email", "email"], ["employeeCode", "Employee ID", "text"], ["department", "Department", "text"], ["designation", "Designation", "text"], ["joiningDate", "Joining date", "date"], ["salary", "Basic salary", "number"], ["phoneNumber", "Phone", "tel"], ["location", "Location", "text"], ["employmentType", "Employment type", "text"], ["manager", "Reporting manager", "text"]];

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5 shadow-sm"><div><Link href="/employees" className="text-sm font-medium text-blue-600 hover:underline">← Employees</Link><h1 className="mt-2 text-2xl font-bold">Employee profile</h1></div><div className="flex gap-2">{!editing && <button onClick={() => setEditing(true)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold">Edit profile</button>}{isAdmin && employee && <button onClick={() => void toggleStatus()} className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">{employee.status === "Active" ? "Deactivate" : "Reactivate"}</button>}</div></header>
          {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}<button onClick={() => router.push("/employees")} className="ml-2 font-semibold underline">Return to directory</button></div>}
          {success && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}
          {loading || !employee ? <div className="h-64 animate-pulse rounded-3xl bg-white" /> : <>
            <section className="mb-6 rounded-3xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">{employee.firstName.charAt(0)}{employee.lastName.charAt(0)}</div><div><h2 className="text-xl font-bold">{employee.firstName} {employee.lastName}</h2><p className="text-sm text-slate-500">{employee.designation} · {employee.department} · {employee.employeeCode}</p><p className="mt-1 text-sm text-slate-500">{employee.email}</p></div><span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold capitalize text-emerald-700">{employee.status}</span></div></section>
            {editing ? <form onSubmit={save} className="mb-6 grid gap-4 rounded-3xl bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">{fields.map(([field, label, type]) => <label key={field} className="text-sm font-medium">{label}<input type={type} min={type === "number" ? "0" : undefined} value={String(form[field] ?? "")} onChange={(event) => setField(field, event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>)}<div className="flex gap-2 sm:col-span-2 lg:col-span-3"><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">{saving ? "Saving..." : "Save changes"}</button><button type="button" onClick={() => { setEditing(false); setForm(employee); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold">Cancel</button></div></form> : <section className="mb-6 grid gap-4 rounded-3xl bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">{[["Phone", employee.phoneNumber], ["Location", employee.location], ["Employment type", employee.employmentType], ["Reporting manager", employee.manager], ["Joined", employee.joiningDate], ...(employee.salary === undefined ? [] : [["Basic salary", new Intl.NumberFormat(undefined, { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(employee.salary)]])].map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{value || "—"}</p></div>)}</section>}
            <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Recent attendance</h2>{attendance.length ? <ul className="mt-3 divide-y divide-slate-100">{attendance.map((record) => <li key={record.workDate} className="flex justify-between py-3 text-sm"><span>{record.workDate} · <span className="capitalize">{record.status}</span></span><span className="text-slate-500">{record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No attendance history.</p>}</section><section className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Recent leave history</h2>{leaves.length ? <ul className="mt-3 divide-y divide-slate-100">{leaves.map((leave, index) => <li key={`${leave.startDate}-${index}`} className="flex justify-between gap-3 py-3 text-sm"><span className="capitalize">{leave.leaveType} · {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}</span><span className="capitalize text-slate-500">{leave.status}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No leave history.</p>}</section></div>
          </>}
        </div>
      </main>
    </ProtectedRoute>
  );
}
