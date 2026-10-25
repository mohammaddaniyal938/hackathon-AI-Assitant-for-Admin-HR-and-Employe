"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function ChangePasswordPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.dispatchEvent(new Event("hcm-auth-token-changed"));
      queryClient.clear();
      router.replace("/login?passwordChanged=1");
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || "Unable to change password." : "Unable to change password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Account security</p>
          <h1 className="mt-2 text-2xl font-bold">Set a new password</h1>
          <p className="mt-2 text-sm text-slate-600">A password change is required before using {user?.email} account features.</p>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <label className="mt-5 block text-sm font-medium">Current password<input required autoComplete="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
          <label className="mt-4 block text-sm font-medium">New password<input required minLength={12} autoComplete="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /><span className="mt-1 block text-xs text-slate-500">Use at least 12 characters.</span></label>
          <label className="mt-4 block text-sm font-medium">Confirm new password<input required minLength={12} autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
          <button disabled={saving} className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Change password"}</button>
        </form>
      </main>
    </ProtectedRoute>
  );
}
