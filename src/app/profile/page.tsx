"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useState } from "react";
import { ArrowLeft, LockKeyhole, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Card } from "@/components/ui";
import { toast } from "sonner";

export default function ProfilePage() {
  const session = authClient.useSession();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const displayName = name || session.data?.user?.name || "";
  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    try {
      const result = await authClient.updateUser({ name: displayName });
      if (result.error) { const message = result.error.message ?? "Unable to update profile."; setError(message); toast.error(message); }
      else { setMessage("Profile updated successfully."); toast.success("Profile updated successfully."); }
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Unable to update profile."; setError(message); toast.error(message); }
    finally { setSaving(false); }
  }
  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError(""); const form = new FormData(event.currentTarget);
    try {
      const result = await authClient.changePassword({ currentPassword: String(form.get("currentPassword")), newPassword: String(form.get("newPassword")), revokeOtherSessions: true });
      if (result.error) { const message = result.error.message ?? "Unable to change password."; setError(message); toast.error(message); }
      else { setMessage("Password changed and other sessions revoked."); toast.success("Password changed successfully."); event.currentTarget.reset(); }
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Unable to change password."; setError(message); toast.error(message); }
    finally { setSaving(false); }
  }
  const role = (session.data?.user as { role?: string } | undefined)?.role ?? "receptionist";
  return <div className="min-h-screen bg-surface p-5 sm:p-8"><div className="mx-auto max-w-4xl"><Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary"><ArrowLeft size={15}/> Dashboard</Link><div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Profile management</h1><p className="mt-1 text-sm text-slate-500">Manage your account details and session security.</p></div>{message && <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}{error && <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<div className="grid gap-6 md:grid-cols-2"><Card className="p-6"><div className="mb-6 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 font-bold text-primary">{(session.data?.user?.name ?? "Staff").split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><h2 className="font-bold text-slate-900">Account details</h2><p className="text-xs text-slate-500">Your staff identity</p></div></div><form onSubmit={updateProfile} className="space-y-4"><label className="block text-sm font-medium text-slate-700">Full name<div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-blue-500"><UserRound size={16} className="text-slate-400"/><input required value={displayName} onChange={(event) => setName(event.target.value)} className="w-full outline-none"/></div></label><label className="block text-sm font-medium text-slate-700">Email<div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-slate-500"><Mail size={16}/><span>{session.data?.user?.email ?? "Loading..."}</span></div></label><div className="flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-700"><ShieldCheck size={16}/><span>Current role: <strong>{role.replaceAll("_", " ")}</strong></span></div><button disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save size={15}/> Save profile</button></form></Card><Card className="p-6"><div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-2.5 text-amber-600"><LockKeyhole size={19}/></div><div><h2 className="font-bold text-slate-900">Password & sessions</h2><p className="text-xs text-slate-500">Keep your account secure</p></div></div><form onSubmit={updatePassword} className="space-y-4"><label className="block text-sm font-medium text-slate-700">Current password<input required type="password" name="currentPassword" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"/></label><label className="block text-sm font-medium text-slate-700">New password<input required minLength={8} type="password" name="newPassword" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"/></label><p className="text-xs leading-5 text-slate-500">Changing your password will revoke other active sessions.</p><button disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60">Change password</button></form></Card></div></div></div>;
}
