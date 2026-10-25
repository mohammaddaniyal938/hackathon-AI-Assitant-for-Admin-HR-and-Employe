"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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
  joiningDate: string;
  salary: number;
  location?: string;
}

interface EmployeeListResponse {
  employees: Employee[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

interface ImportRow {
  rowNumber: number;
  values: Record<string, string>;
  initialPassword: string;
  errors: string[];
  result: string;
}

const initialForm = {
  firstName: "",
  lastName: "",
  email: "",
  employeeCode: "",
  department: "",
  designation: "",
  joiningDate: "",
  salary: "",
  location: "",
  initialPassword: "",
};

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') {
      field += '"';
      index++;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
};

export default function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("lastName");
  const [order, setOrder] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user || user.role === "employee") {
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        sort,
        order,
      });
      if (query.trim()) params.set("q", query.trim());
      if (department) params.set("department", department);
      if (designation) params.set("designation", designation);
      if (location) params.set("location", location);
      if (status) params.set("status", status);
      api.get<EmployeeListResponse>(`/employees?${params.toString()}`)
        .then(({ data }) => {
          if (!active) return;
          setEmployees(data.employees);
          setPagination(data.pagination);
          setError("");
        })
        .catch((requestError: unknown) => {
          if (!active) return;
          if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
            setError("You do not have permission to view employee records.");
          } else if (!axios.isAxiosError(requestError) || requestError.response?.status !== 401) {
            setError("Unable to load employees. Please try again.");
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, query ? 250 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [user, pagination.page, pagination.limit, query, department, designation, location, status, sort, order, refreshKey]);

  const createEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post<{ employee: Employee; message: string }>("/employees", {
        ...form,
        salary: Number(form.salary || 0),
      });
      setForm(initialForm);
      setPagination((current) => ({ ...current, page: 1 }));
      setSuccess(data.message);
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        setError(requestError.response?.data?.message || "Unable to create employee.");
      } else {
        setError("Unable to create employee.");
      }
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: "1", limit: "100", sort, order });
      if (query.trim()) params.set("q", query.trim());
      if (department) params.set("department", department);
      if (designation) params.set("designation", designation);
      if (location) params.set("location", location);
      if (status) params.set("status", status);
      const allEmployees: Employee[] = [];
      const firstPage = await api.get<EmployeeListResponse>(`/employees?${params.toString()}`);
      allEmployees.push(...firstPage.data.employees);
      for (let page = 2; page <= firstPage.data.pagination.pages; page++) {
        params.set("page", String(page));
        const { data } = await api.get<EmployeeListResponse>(`/employees?${params.toString()}`);
        allEmployees.push(...data.employees);
      }
      const columns: Array<keyof Employee> = ["employeeCode", "firstName", "lastName", "email", "department", "designation", "joiningDate", "status"];
      const rows = [columns.join(","), ...allEmployees.map((employee) => columns.map((column) => `"${String(employee[column] ?? "").replaceAll('"', '""')}"`).join(","))];
      const url = URL.createObjectURL(new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "employees.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to export employees." : "Unable to export employees.");
    } finally {
      setExporting(false);
    }
  };

  const changeSort = (field: string) => {
    if (sort === field) setOrder((current) => current === "asc" ? "desc" : "asc");
    else {
      setSort(field);
      setOrder("asc");
    }
  };

  const previewCsv = async (file?: File) => {
    setImportRows([]);
    setError("");
    if (!file) return;
    try {
      const rawRows = parseCsv(await file.text());
      if (rawRows.length < 2) throw new Error("CSV must contain a header and at least one employee row.");
      if (rawRows.length > 101) throw new Error("Import is limited to 100 employees per file.");
      const headers = rawRows[0].map((header) => header.trim().toLowerCase());
      const required = ["firstname", "lastname", "email", "employeecode", "department", "designation"];
      const missing = required.filter((header) => !headers.includes(header));
      if (missing.length) throw new Error(`Missing required CSV columns: ${missing.join(", ")}`);
      const first = await api.get<EmployeeListResponse>("/employees?page=1&limit=100");
      const existingEmployees = [...first.data.employees];
      for (let page = 2; page <= first.data.pagination.pages; page++) {
        const { data } = await api.get<EmployeeListResponse>(`/employees?page=${page}&limit=100`);
        existingEmployees.push(...data.employees);
      }
      const knownEmails = new Set(existingEmployees.map((employee) => employee.email.toLowerCase()));
      const knownCodes = new Set(existingEmployees.map((employee) => employee.employeeCode.toLowerCase()));
      const seenEmails = new Set<string>();
      const seenCodes = new Set<string>();
      const imported = rawRows.slice(1).map((cells, index): ImportRow => {
        const values = Object.fromEntries(headers.map((header, column) => [header, cells[column]?.trim() || ""]));
        const errors: string[] = [];
        for (const field of required) {
          if (!values[field]) errors.push(`${field} is required`);
        }
        const emailValue = values.email.toLowerCase();
        const codeValue = values.employeecode.toLowerCase();
        if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push("invalid email");
        if (emailValue && (knownEmails.has(emailValue) || seenEmails.has(emailValue))) errors.push("duplicate email");
        if (codeValue && (knownCodes.has(codeValue) || seenCodes.has(codeValue))) errors.push("duplicate employee ID");
        if (emailValue) seenEmails.add(emailValue);
        if (codeValue) seenCodes.add(codeValue);
        if (values.salary && (!Number.isFinite(Number(values.salary)) || Number(values.salary) < 0)) errors.push("salary must be a non-negative number");
        if (values.joiningdate && (!/^\d{4}-\d{2}-\d{2}$/.test(values.joiningdate) || Number.isNaN(new Date(values.joiningdate).getTime()) || new Date(values.joiningdate).toISOString().slice(0, 10) !== values.joiningdate)) errors.push("invalid joining date (use YYYY-MM-DD)");
        return { rowNumber: index + 2, values, initialPassword: "", errors, result: "" };
      });
      setImportRows(imported);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to read employee CSV.");
    }
  };

  const submitImport = async () => {
    setImporting(true);
    setError("");
    let created = 0;
    const results = [...importRows];
    for (let index = 0; index < results.length; index++) {
      const row = results[index];
      if (row.errors.length) continue;
      if (row.initialPassword.length < 12) {
        row.result = "Add a 12+ character initial password";
        continue;
      }
      row.result = "Creating...";
      setImportRows([...results]);
      const values = row.values;
      try {
        await api.post("/employees", {
          firstName: values.firstname,
          lastName: values.lastname,
          email: values.email,
          employeeCode: values.employeecode,
          department: values.department,
          designation: values.designation,
          joiningDate: values.joiningdate || undefined,
          salary: values.salary ? Number(values.salary) : 0,
          location: values.location || "",
          initialPassword: row.initialPassword,
        });
        created++;
        row.result = "Created";
        row.initialPassword = "";
      } catch (requestError) {
        row.result = axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Creation failed" : "Creation failed";
      }
      row.initialPassword = "";
      setImportRows([...results]);
    }
    setImporting(false);
    setRefreshKey((current) => current + 1);
    setSuccess(`CSV import finished: ${created} employee${created === 1 ? "" : "s"} created. Review row results for errors.`);
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5 shadow-sm">
            <div>
              <Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">← Dashboard</Link>
              <h1 className="mt-2 text-2xl font-bold">Employees</h1>
              <p className="mt-1 text-sm text-slate-500">Search, filter, and manage your employee directory</p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <button type="button" onClick={() => void exportCsv()} disabled={exporting || !employees.length} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">{exporting ? "Exporting..." : "Export filtered CSV"}</button>
              {user?.role !== "employee" && <button type="button" onClick={() => setImportOpen((open) => !open)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Import CSV</button>}
              {user?.role !== "employee" && <button type="button" onClick={() => setFormOpen((open) => !open)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Add employee</button>}
            </div>
          </header>

          {user?.role === "employee" ? (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">Employee directory access is limited to Admin and HR.</div>
          ) : (
            <>
              {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
              {success && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

              {formOpen && (
                <form onSubmit={createEmployee} className="mb-6 grid gap-4 rounded-3xl bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    ["firstName", "First name", true],
                    ["lastName", "Last name", true],
                    ["email", "Work email", true],
                    ["employeeCode", "Employee ID", true],
                    ["department", "Department", true],
                    ["designation", "Designation", true],
                    ["joiningDate", "Joining date", false],
                    ["salary", "Basic salary", false],
                    ["location", "Location", false],
                    ["initialPassword", "Initial password (12+ characters)", true],
                  ] as const).map(([key, label, required]) => (
                    <label key={key} className="text-sm font-medium text-slate-700">
                      {label}
                      <input
                        type={key === "email" ? "email" : key === "joiningDate" ? "date" : key === "salary" ? "number" : key === "initialPassword" ? "password" : "text"}
                        minLength={key === "initialPassword" ? 12 : undefined}
                        autoComplete={key === "initialPassword" ? "new-password" : undefined}
                        min={key === "salary" ? "0" : undefined}
                        required={required}
                        value={form[key]}
                        onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500"
                      />
                    </label>
                  ))}
                  <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                    <button disabled={saving} type="submit" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Creating..." : "Create employee"}</button>
                    <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Cancel</button>
                  </div>
                </form>
              )}

              {importOpen && <section className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Import employees from CSV</h2><p className="mt-1 text-xs text-slate-500">Required columns: firstName, lastName, email, employeeCode, department, designation. Optional: joiningDate, salary, location. Set an initial password per employee below; password values are never imported from CSV or returned.</p></div><button type="button" onClick={() => { setImportOpen(false); setImportRows([]); }} className="text-sm font-semibold text-slate-500">Close</button></div>
                <input type="file" accept=".csv,text/csv" onChange={(event) => void previewCsv(event.target.files?.[0])} className="mt-4 block w-full text-sm" />
                {importRows.length > 0 && <><div className="mt-4 overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Email / ID</th><th className="px-3 py-2">Validation</th><th className="px-3 py-2">Initial password</th><th className="px-3 py-2">Result</th></tr></thead><tbody>{importRows.map((row, index) => <tr key={row.rowNumber} className="border-t border-slate-100"><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2">{row.values.firstname} {row.values.lastname}</td><td className="px-3 py-2">{row.values.email}<br />{row.values.employeecode}</td><td className="px-3 py-2 text-red-700">{row.errors.join(", ") || "Valid"}</td><td className="px-3 py-2"><input type="password" autoComplete="new-password" minLength={12} disabled={Boolean(row.result)} aria-label={`Initial password for CSV row ${row.rowNumber}`} value={row.initialPassword} onChange={(event) => { const copy = [...importRows]; copy[index].initialPassword = event.target.value; setImportRows(copy); }} className="w-48 rounded-lg border border-slate-200 px-2 py-1.5" /></td><td className="px-3 py-2">{row.result}</td></tr>)}</tbody></table></div><button type="button" onClick={() => void submitImport()} disabled={importing || !importRows.some((row) => !row.errors.length && !row.result)} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{importing ? "Importing..." : "Create valid rows"}</button></>}
              </section>}

              <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <input aria-label="Search employees" value={query} onChange={(event) => { setQuery(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} placeholder="Search name, ID, email" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm lg:col-span-2" />
                  <input aria-label="Filter by department" value={department} onChange={(event) => { setDepartment(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} placeholder="Department" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                  <input aria-label="Filter by designation" value={designation} onChange={(event) => { setDesignation(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} placeholder="Designation" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                  <input aria-label="Filter by location" value={location} onChange={(event) => { setLocation(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} placeholder="Location" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                  <select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <option value="">All statuses</option><option>Active</option><option>Inactive</option>
                  </select>
                  <p className="self-center text-sm text-slate-500">{pagination.total} employee{pagination.total === 1 ? "" : "s"}</p>
                </div>

                {loading ? (
                  <div className="space-y-3" aria-label="Loading employees">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>
                ) : employees.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-10 text-center">
                    <h2 className="font-semibold">No employees found</h2>
                    <p className="mt-2 text-sm text-slate-500">Try a different search or add an employee.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[760px] w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3"><button onClick={() => changeSort("lastName")} type="button">Employee {sort === "lastName" ? (order === "asc" ? "↑" : "↓") : ""}</button></th>
                          <th className="px-4 py-3"><button onClick={() => changeSort("employeeCode")} type="button">Employee ID</button></th>
                          <th className="px-4 py-3"><button onClick={() => changeSort("department")} type="button">Department</button></th>
                          <th className="px-4 py-3">Designation</th>
                          <th className="px-4 py-3"><button onClick={() => changeSort("joiningDate")} type="button">Joined</button></th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Profile</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((employee) => (
                          <tr key={employee.id} className="border-t border-slate-100">
                            <td className="px-4 py-3"><p className="font-semibold text-slate-800">{employee.firstName} {employee.lastName}</p><p className="mt-1 text-xs text-slate-500">{employee.email}</p></td>
                            <td className="px-4 py-3 text-slate-600">{employee.employeeCode}</td>
                            <td className="px-4 py-3 text-slate-600">{employee.department}</td>
                            <td className="px-4 py-3 text-slate-600">{employee.designation}</td>
                            <td className="px-4 py-3 text-slate-600">{employee.joiningDate || "—"}</td>
                            <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${employee.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{employee.status}</span></td>
                            <td className="px-4 py-3"><Link href={`/employees/${employee.id}`} className="font-semibold text-blue-600 hover:underline">View</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <p className="text-sm text-slate-500">Page {pagination.page} of {Math.max(1, pagination.pages)}</p>
                  <div className="flex gap-2">
                    <button type="button" disabled={pagination.page <= 1 || loading} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40">Previous</button>
                    <button type="button" disabled={pagination.page >= pagination.pages || loading} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40">Next</button>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
