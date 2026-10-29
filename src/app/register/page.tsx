"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, Stethoscope, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true); const form = new FormData(event.currentTarget);
    try {
      const result = await authClient.signUp.email({ name: String(form.get("name")), email: String(form.get("email")), password: String(form.get("password")) });
      if (result.error) { const message = result.error.message ?? "Unable to create account."; setError(message); toast.error(message); }
      else { toast.success("Staff account created successfully."); router.replace("/"); }
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Unable to create account."; setError(message); toast.error(message); }
    finally { setLoading(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-surface p-5"><div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-10"><div className="mb-8 flex items-center gap-3"><div className="rounded-xl bg-primary p-2 text-white"><Stethoscope size={21}/></div><div><p className="font-bold text-slate-900">MediCore</p><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-primary">Diagnostics</p></div></div><h1 className="text-2xl font-bold text-slate-900">Create staff account</h1><p className="mt-2 text-sm text-slate-500">New accounts start with the receptionist role. A manager can assign additional permissions.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-medium text-slate-700">Full name<div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-blue-500"><UserRound size={17} className="text-slate-400"/><input required name="name" className="w-full outline-none" placeholder="Staff name"/></div></label><label className="block text-sm font-medium text-slate-700">Email<div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-blue-500"><Mail size={17} className="text-slate-400"/><input required type="email" name="email" className="w-full outline-none" placeholder="staff@clinic.com"/></div></label><label className="block text-sm font-medium text-slate-700">Password<div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-blue-500"><LockKeyhole size={17} className="text-slate-400"/><input required minLength={8} type="password" name="password" className="w-full outline-none" placeholder="At least 8 characters"/></div></label>{error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">{loading ? "Creating..." : "Create account"}<ArrowRight size={16}/></button></form><button onClick={() => router.push("/login")} className="mt-5 w-full text-center text-sm font-medium text-primary">Back to sign in</button></div></main>;
}
