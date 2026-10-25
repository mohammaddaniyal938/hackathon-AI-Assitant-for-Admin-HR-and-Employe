"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import axios from "axios";

interface KpiCard {
  label: string;
  value: string;
  delta: string;
  tone: string;
}

interface DashboardSummary {
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
  };
  kpis: KpiCard[];
  departmentBreakdown: Array<{ name: string; value: number; salary: number }>;
  recentActivity: Array<{ id: string; title: string; time: string; details: string }>;
  approvals: Array<{ id: string; name: string; type: string; status: string }>;
  employeeCount?: number;
  assistant: {
    summary: string;
    quickActions: string[];
  };
}

const navItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "Employees", href: "/employees" },
  { label: "Attendance", href: "/attendance" },
  { label: "Payroll", href: "/payroll" },
  { label: "Leaves", href: "/leaves" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/settings" },
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    async function fetchSummary() {
      try {
        const { data } = await api.get<DashboardSummary>("/dashboard/summary");
        setSummary(data);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          setDashboardError("You do not have permission to view this dashboard.");
        } else if (!axios.isAxiosError(error) || error.response?.status !== 401) {
          setDashboardError("Unable to load dashboard data. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchSummary();
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const role = (summary?.role || user?.role || "employee").toLowerCase();
  const maxDepartmentCount = Math.max(1, ...(summary?.departmentBreakdown || []).map((department) => department.value));
  const roleTitle = role === "admin" ? "Admin dashboard" : role === "hr" ? "HR dashboard" : "Employee dashboard";
  const visibleNavItems = role === "admin"
    ? navItems
    : role === "hr"
    ? navItems
    : navItems.filter((item) => ["Overview", "Attendance", "Leaves", "Payroll"].includes(item.label));

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <div className="flex min-h-screen">
          <aside className="hidden w-72 shrink-0 bg-slate-950 p-6 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:self-start">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 text-lg font-bold">H</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-200">HCM</p>
                <p className="text-xl font-bold">Lite</p>
              </div>
            </div>

            <nav className="space-y-2">
              {visibleNavItems.map((item, index) => (
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-current={item.href === "/dashboard" ? "page" : undefined}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                      item.href === "/dashboard" ? "bg-blue-500/20 text-blue-100" : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="text-xs text-slate-400">0{index + 1}</span>
                  </Link>
                ) : null
              ))}
            </nav>

            <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AI assistant</p>
              <p className="mt-3 text-sm text-slate-200">{summary?.assistant?.summary || "Your HR insights will appear here."}</p>
            </div>
          </aside>

          <main className="min-w-0 flex-1 p-4 md:p-8">
            <div className="mb-4 lg:hidden">
              <button type="button" aria-expanded={mobileNavOpen} aria-controls="mobile-primary-navigation" onClick={() => setMobileNavOpen((open) => !open)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
                {mobileNavOpen ? "Close menu" : "Menu"}
              </button>
              {mobileNavOpen && <div role="dialog" aria-modal="true" aria-label="Mobile navigation" className="fixed inset-0 z-40 bg-slate-950/50" onClick={() => setMobileNavOpen(false)}>
                <nav id="mobile-primary-navigation" aria-label="Primary navigation" className="h-full w-72 max-w-[85vw] bg-slate-950 p-5 text-white shadow-xl" onClick={(event) => event.stopPropagation()}>
                  <div className="mb-8 flex items-center justify-between"><span className="text-lg font-bold">HCM Lite</span><button type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/10">×</button></div>
                  <div className="space-y-2">{visibleNavItems.filter((item) => item.href).map((item) => (
                    <Link key={item.label} href={item.href!} onClick={() => setMobileNavOpen(false)} className="block rounded-xl px-3 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">
                      {item.label}
                    </Link>
                  ))}</div>
                </nav>
              </div>}
            </div>
            <header className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-slate-500">Welcome back</p>
                <h1 className="text-2xl font-bold">{summary?.user?.name || user?.firstName || user?.email || "Employee"}</h1>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
                    {summary?.user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{summary?.user?.name || user?.email}</p>
                    <p className="text-xs text-slate-500">{roleTitle}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">
                  Logout
                </button>
              </div>
            </header>

            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">{roleTitle}</h2>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Live data
                </span>
              </div>

              {loading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
                  ))}
                </div>
              ) : dashboardError ? (
                <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                  {dashboardError}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {summary?.kpis?.map((kpi) => (
                    <div key={kpi.label} className="rounded-2xl bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-500">{kpi.label}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                          kpi.tone === "emerald" ? "bg-emerald-100 text-emerald-700" :
                          kpi.tone === "violet" ? "bg-violet-100 text-violet-700" :
                          kpi.tone === "amber" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
                        }`}>
                          {kpi.delta}
                        </span>
                      </div>
                      <p className="mt-4 text-3xl font-bold">{kpi.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {summary && role !== "employee" && (
              <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">Department overview</h3>
                    <span className="text-sm text-slate-500">Current month</span>
                  </div>
                  <div className="mt-6 space-y-4">
                    {summary.departmentBreakdown.length === 0 ? <p className="text-sm text-slate-500">No department data is available yet.</p> : summary.departmentBreakdown.map((department) => (
                      <div key={department.name}>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">{department.name}</span>
                          <span className="text-slate-500">{department.value} team members</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                            style={{ width: `${(department.value / maxDepartmentCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-bold">Organization insight</h3>
                  <p className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                    {summary.assistant.summary} This is not AI-generated.
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600">
                    {summary.assistant.quickActions.map((action) => (
                      <li key={action} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-500" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {summary && role !== "employee" && (
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-bold">Recent activity</h3>
                  <div className="mt-4 space-y-4">
                    {summary.recentActivity.length === 0 ? <p className="text-sm text-slate-500">No activity has been recorded yet.</p> : summary.recentActivity.map((item, index) => (
                      <div key={item.id || `${item.title}-${item.time}-${index}`} className="flex gap-3 rounded-2xl border border-slate-200 p-3">
                        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <div>
                          <p className="font-semibold text-slate-800">{item.title}</p>
                          <p className="text-xs text-slate-500">{item.time}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-bold">Approvals queue</h3>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Employee</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.approvals.length === 0 ? <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-500">No pending approvals.</td></tr> : summary.approvals.map((item, index) => (
                          <tr key={item.id || `${item.name}-${item.type}-${index}`} className="border-t border-slate-200">
                            <td className="px-3 py-2 font-medium text-slate-700">{item.name}</td>
                            <td className="px-3 py-2 text-slate-600">{item.type}</td>
                            <td className="px-3 py-2">
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

      </div>
    </ProtectedRoute>
  );
}
