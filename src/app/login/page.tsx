"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Activity, ArrowLeft, ArrowRight, Check, FileText, LockKeyhole, Mail, Printer, Search, ShieldCheck, Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useCentreName } from "@/components/centre-name";

type PatientReport = { reference: string; status: "approved" | "delivered"; verifiedAt: string | null; approvedAt: string | null; deliveredAt: string | null; orderedAt: string; patientName: string; testName: string; department: string; resultText: string; verifiedBy: string | null; approvedBy: string | null };

export default function LoginPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const branding = useCentreName().data;
  const centreName = branding?.name ?? "MediCore Diagnostics";
  const loginTitle = branding?.loginTitle ?? "Care, connected. Operations, simplified.";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [patientReportsOpen, setPatientReportsOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [reportId, setReportId] = useState("");
  const [report, setReport] = useState<PatientReport | null>(null);
  const [reportError, setReportError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => { if (session.data?.user) router.replace("/"); }, [router, session.data?.user]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") !== "patient-reports") return;
    const timer = window.setTimeout(() => setPatientReportsOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({ email: String(form.get("email")), password: String(form.get("password")) });
    setLoading(false);
    if (result.error) setError(result.error.message ?? "Unable to sign in.");
    else router.replace("/");
  }

  async function lookupReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReportLoading(true);
    setReportError("");
    setReport(null);
    try {
      const response = await fetch("/api/patient-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ phone, reportId }),
      });
      const result = await response.json() as { report?: PatientReport; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to find the report.");
      setReport(result.report ?? null);
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : "Unable to find the report.");
    } finally {
      setReportLoading(false);
    }
  }

  function printReport() {
    document.body.classList.add("patient-report-print-mode");
    const cleanup = () => document.body.classList.remove("patient-report-print-mode");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(() => { window.print(); window.setTimeout(cleanup, 1000); }, 100);
  }

  return <main className="flex min-h-screen items-center justify-center bg-surface p-5">
    <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
      <button type="button" onClick={() => { setPatientReportsOpen(true); setReportError(""); }} className="absolute right-6 top-5 z-10 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-primary shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:right-8">Patient reports</button>
      <section className="hidden bg-primary p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 p-2"><Stethoscope size={22}/></div>
            <div className="min-w-0"><p className="max-w-[17rem] truncate font-bold">{centreName}</p></div>
          </div>
          <h1 className="mt-20 whitespace-pre-line text-4xl font-bold leading-tight">{loginTitle}</h1>
          <p className="mt-5 max-w-sm text-sm leading-6 text-blue-100">Securely manage patients, lab workflows, reports and billing from one diagnostic centre workspace.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-blue-100"><Activity size={15}/> Secure clinical operations</div>
      </section>

      <section className="px-7 pb-7 pt-16 sm:px-10 sm:pb-10 sm:pt-16">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="inline-flex shrink-0 rounded-xl bg-primary p-2 text-white"><Stethoscope size={21}/></div>
          <p className="truncate font-bold text-slate-900">{centreName}</p>
        </div>
        {patientReportsOpen ? <>
          <button type="button" onClick={() => { setPatientReportsOpen(false); setReport(null); setReportError(""); }} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-primary"><ArrowLeft size={16}/> Staff sign in</button>
          <div className="mb-6 flex items-start gap-3"><span className="rounded-xl bg-primary-light p-3 text-primary"><FileText size={22}/></span><div><h2 className="text-2xl font-bold text-slate-900">Patient reports</h2><p className="mt-1 text-sm leading-6 text-slate-600">Enter the registered mobile number and report reference provided by the centre.</p></div></div>
          <form onSubmit={lookupReport} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Registered mobile number<input required type="tel" autoComplete="tel" inputMode="tel" maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. 017XXXXXXXX" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-700 outline-none placeholder:text-slate-400 focus:border-primary"/></label>
            <label className="block text-sm font-medium text-slate-700">Report reference<input required autoComplete="off" maxLength={64} value={reportId} onChange={(event) => setReportId(event.target.value)} placeholder="Enter the report ID from the centre" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-700 outline-none placeholder:text-slate-400 focus:border-primary"/><span className="mt-1 block text-xs font-normal text-slate-500">Both details are required to protect your medical information.</span></label>
            {reportError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{reportError}</p>}
            <button disabled={reportLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"><Search size={17}/>{reportLoading ? "Checking report…" : "Find my report"}</button>
          </form>
          {report && <><article className="patient-report-print-sheet mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" aria-live="polite"><div className="flex items-center gap-2 text-emerald-800"><Check size={19}/><h3 className="font-bold">Approved diagnostic report</h3></div><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-emerald-800/70">Patient</dt><dd className="font-semibold text-slate-900">{report.patientName}</dd></div><div><dt className="text-emerald-800/70">Test</dt><dd className="font-semibold text-slate-900">{report.testName}</dd></div><div><dt className="text-emerald-800/70">Department</dt><dd className="font-semibold text-slate-900">{report.department}</dd></div><div><dt className="text-emerald-800/70">Reference</dt><dd className="break-all font-mono text-xs text-slate-900">{report.reference}</dd></div><div><dt className="text-emerald-800/70">Verified by</dt><dd className="font-semibold text-slate-900">{report.verifiedBy ?? "Authorized reviewer"}</dd></div><div><dt className="text-emerald-800/70">Approved by</dt><dd className="font-semibold text-slate-900">{report.approvedBy ?? "Authorized approver"}</dd></div><div><dt className="text-emerald-800/70">Verified at</dt><dd className="font-semibold text-slate-900">{report.verifiedAt ? new Date(report.verifiedAt).toLocaleString() : "—"}</dd></div><div><dt className="text-emerald-800/70">Approved at</dt><dd className="font-semibold text-slate-900">{report.approvedAt ? new Date(report.approvedAt).toLocaleString() : "—"}</dd></div></dl><div className="mt-4 border-t border-emerald-200 pt-4"><h4 className="text-sm font-bold text-slate-900">Result / findings</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-900">{report.resultText}</p></div><p className="mt-4 border-t border-emerald-200 pt-3 text-xs text-emerald-900">This electronic report is available after staff approval. Contact {centreName} for a signed copy or clinical interpretation.</p></article><button type="button" onClick={printReport} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Printer size={16}/>Print / Save as PDF</button></>}
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary"/><p>Only verified reports can be viewed. Keep your report reference private.</p></div>
        </> : <>
          <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-500">Sign in to your diagnostic centre account.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block text-sm font-medium text-slate-700">Email<div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-blue-500"><Mail size={17} className="text-slate-400"/><input required type="email" name="email" className="w-full outline-none" placeholder="you@clinic.com"/></div></label>
            <label className="block text-sm font-medium text-slate-700">Password<div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-blue-500"><LockKeyhole size={17} className="text-slate-400"/><input required type="password" name="password" className="w-full outline-none" placeholder="••••••••"/></div></label>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">{loading ? "Signing in…" : "Sign in"}<ArrowRight size={16}/></button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">Staff accounts are provided by your super administrator.</p>
        </>}
      </section>
    </div>
  </main>;
}
