"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const highlights = [
  "Role-based access for admin, HR and employees",
  "Attendance, payroll, leave and employee workflows",
  "AI-assisted summary and HR dashboard reporting",
];

export default function Home() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex max-w-6xl flex-col px-6 py-10 md:px-10">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 font-bold text-white">H</div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200">HCM Lite</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="rounded-full bg-blue-500 px-5 py-2 font-medium text-white hover:bg-blue-400">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white hover:bg-white/5">
                  Login
                </Link>
                <Link href="/register" className="rounded-full bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-400">
                  Register
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="grid items-center gap-10 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-blue-400/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">
              Saylani Hackathon Edition
            </p>
            <h1 className="max-w-xl text-5xl font-black leading-tight md:text-6xl">
              Human capital management made simple.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              This upgraded project keeps the working stack and adds a professional HR SaaS experience covering employee management, attendance, leave, payroll, and AI-assisted summaries.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/login" className="rounded-full bg-blue-500 px-6 py-3 font-semibold text-white hover:bg-blue-400">
                Open dashboard
              </Link>
              <Link href="/register" className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white hover:bg-white/5">
                Create employee account
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-blue-950/40 backdrop-blur-sm">
            <div className="grid gap-4">
              {highlights.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-sm text-white">✓</div>
                  <p className="text-sm text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
