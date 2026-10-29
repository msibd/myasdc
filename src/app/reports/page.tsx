"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ClipboardCheck, Clock3, FileText, MessageSquare, PenLine, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";

type WorkflowEvent = { id: string; action: string; createdAt: string; note: string | null; actor: { name: string } | null };
type Report = {
  id: string; status: string; resultText: string | null; resultEnteredAt: string | null; verifiedAt: string | null; approvedAt: string | null; deliveredAt: string | null;
  enteredBy: { id: string; name: string } | null; verifiedBy: { id: string; name: string } | null; approvedBy: { id: string; name: string } | null;
  labOrder: { id: string; createdAt: string; status: string; sampleBarcode: string | null; specimenType: string | null; technician: { id: string; name: string } | null; doctor: { id: string; name: string } | null; patient: { id: string; name: string; phone: string | null }; diagnosticTest: { name: string; department: string }; invoice: { id: string; total: string | number; paid: string | number; status: string } | null; workflowEvents: WorkflowEvent[] };
};
type ReportResponse = { reports: Report[]; permissions: { canEdit: boolean; canVerify: boolean; canApprove: boolean; canDeliver: boolean } };

async function getReports(): Promise<ReportResponse> {
  const response = await fetch("/api/reports", { cache: "no-store" });
  const result = await response.json().catch(() => null) as ReportResponse | { error?: string } | null;
  if (!response.ok || !result || !("reports" in result)) throw new Error(result && "error" in result ? result.error ?? "Unable to load reports." : "Unable to load reports.");
  return result;
}

const actionLabel: Record<string, string> = { test_order_created: "Test order created", invoice_issued: "Invoice issued", report_record_created: "Report record opened", sample_collected: "Sample collected", technician_assigned: "Technician assigned", result_entered: "Result entered", result_verified: "Result verified", report_approved: "Report approved", report_delivered: "Report delivered", report_sms_sent: "Patient notification sent" };

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Report | null>(null);
  const [smsTarget, setSmsTarget] = useState<Report | null>(null);
  const reportsQuery = useQuery({ queryKey: ["reports"], queryFn: getReports });
  const reports = reportsQuery.data?.reports ?? [];
  const permissions = reportsQuery.data?.permissions;
  const action = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Report workflow action failed.");
      return result;
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["reports"] }); await queryClient.invalidateQueries({ queryKey: ["lab-orders"] }); setEditing(null); },
  });
  const sendSms = useMutation({
    mutationFn: async (report: Report) => {
      const response = await fetch(`/api/reports/${encodeURIComponent(report.id)}/notify`, { method: "POST" });
      const result = await response.json().catch(() => null) as { error?: string; sent?: boolean } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to send report notification.");
      return result;
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["reports"] }); setSmsTarget(null); },
  });
  const pending = reports.filter((report) => report.status === "draft").length;
  const verified = reports.filter((report) => report.status === "verified").length;
  const approved = reports.filter((report) => report.status === "approved").length;
  const delivered = reports.filter((report) => report.status === "delivered").length;

  function saveResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    action.mutate({ action: "result", id: editing.id, resultText: String(form.get("resultText") ?? "") });
  }

  return <div className="min-h-screen bg-surface p-5 sm:p-8"><div className="mx-auto max-w-[1400px]">
    <div className="mb-6 flex items-center justify-between gap-3"><div><Link href="/" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary"><ArrowLeft size={15}/> Dashboard</Link><h1 className="text-2xl font-bold text-slate-900">Reports</h1><p className="mt-1 text-sm text-slate-600">Enter results, independently verify and approve, then release the patient report.</p></div><Link href="/lab-workstation?action=new" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark">New test order</Link></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-600">Results pending</p><PenLine size={18} className="text-amber-600"/></div><p className="mt-2 text-2xl font-bold text-slate-900">{reportsQuery.isLoading ? "—" : pending}</p></Card><Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-600">Verified</p><ShieldCheck size={18} className="text-blue-600"/></div><p className="mt-2 text-2xl font-bold text-slate-900">{reportsQuery.isLoading ? "—" : verified}</p></Card><Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-600">Awaiting delivery</p><ClipboardCheck size={18} className="text-violet-600"/></div><p className="mt-2 text-2xl font-bold text-slate-900">{reportsQuery.isLoading ? "—" : approved}</p></Card><Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-600">Delivered</p><Check size={18} className="text-emerald-600"/></div><p className="mt-2 text-2xl font-bold text-slate-900">{reportsQuery.isLoading ? "—" : delivered}</p></Card></div>
    {reportsQuery.isError && <div role="alert" className="mb-5 flex items-center justify-between rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{reportsQuery.error.message}<button onClick={() => void reportsQuery.refetch()} className="font-semibold underline">Retry</button></div>}
    {action.isError && <div role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{action.error.message}</div>}
    <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Report workflow queue</h2><p className="mt-1 text-xs text-slate-600">Each action is recorded with the staff member and timestamp.</p></div><Badge tone="amber">{pending} pending result/review</Badge></div>
      {reportsQuery.isLoading ? <div className="space-y-3 p-5">{[0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-xl bg-slate-100"/>)}</div> : reports.length === 0 ? <div className="p-12 text-center"><FileText size={28} className="mx-auto text-slate-400"/><h3 className="mt-3 font-semibold text-slate-900">No report records yet</h3><p className="mt-1 text-sm text-slate-600">Register a test order in Lab workstation to create its linked report record.</p><Link href="/lab-workstation?action=new" className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">Create test order</Link></div> : <div className="divide-y divide-slate-100">{reports.map((report) => <article key={report.id} className="space-y-4 p-5">
        <div className="flex flex-wrap items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary"><FileText size={18}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-900">{report.labOrder.patient.name}</h3><code className="break-all text-[11px] text-slate-600">{report.id}</code></div><p className="mt-1 text-xs text-slate-700">{report.labOrder.diagnosticTest.name} · {report.labOrder.diagnosticTest.department} · specimen: {report.labOrder.specimenType ?? "not recorded"}</p><p className="mt-1 text-xs text-slate-600">Barcode {report.labOrder.sampleBarcode ?? "—"} · Technician {report.labOrder.technician?.name ?? "unassigned"} · Invoice {report.labOrder.invoice?.status ?? "not linked"}</p></div><Badge tone={report.status === "delivered" ? "green" : report.status === "approved" ? "blue" : report.status === "verified" ? "green" : "amber"}>{report.status}</Badge></div>
        {report.resultText && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">Result</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-900">{report.resultText}</p></div>}
        <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3"><p>Entered: <strong className="text-slate-800">{report.enteredBy?.name ?? "Not entered"}</strong></p><p>Verified: <strong className="text-slate-800">{report.verifiedBy?.name ?? "Not yet"}</strong></p><p>Approved: <strong className="text-slate-800">{report.approvedBy?.name ?? "Not yet"}</strong></p></div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {report.status === "draft" && permissions?.canEdit && <button onClick={() => { setEditing(report); action.reset(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><PenLine size={14}/>{report.resultText ? "Edit result" : "Enter result"}</button>}
          {report.status === "draft" && report.resultText && permissions?.canVerify && <button disabled={action.isPending} onClick={() => action.mutate({ action: "verify", id: report.id })} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"><ShieldCheck size={14}/>Verify result</button>}
          {report.status === "verified" && permissions?.canApprove && <button disabled={action.isPending} onClick={() => action.mutate({ action: "approve", id: report.id })} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"><ClipboardCheck size={14}/>Approve report</button>}
          {report.status === "approved" && permissions?.canDeliver && <button disabled={action.isPending} onClick={() => action.mutate({ action: "deliver", id: report.id })} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"><Check size={14}/>Mark delivered</button>}
          {["approved", "delivered"].includes(report.status) && permissions?.canDeliver && report.labOrder.patient.phone && <button disabled={sendSms.isPending} onClick={() => { setSmsTarget(report); sendSms.reset(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary hover:bg-primary-light disabled:opacity-50"><MessageSquare size={14}/>SMS patient</button>}
          {(report.status === "approved" || report.status === "delivered") && <Link href="/login?view=patient-reports" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Patient portal</Link>}
          <span className="ml-auto text-[11px] text-slate-500">{report.deliveredAt ? `Delivered ${new Date(report.deliveredAt).toLocaleString()}` : report.approvedAt ? `Approved ${new Date(report.approvedAt).toLocaleString()}` : report.verifiedAt ? `Verified ${new Date(report.verifiedAt).toLocaleString()}` : report.resultEnteredAt ? `Result saved ${new Date(report.resultEnteredAt).toLocaleString()}` : `Created ${new Date(report.labOrder.createdAt).toLocaleString()}`}</span>
        </div>
        {report.labOrder.workflowEvents?.length > 0 && <details className="rounded-xl border border-slate-200 px-3 py-2"><summary className="text-xs font-semibold text-slate-700">Traceability timeline ({report.labOrder.workflowEvents.length})</summary><ol className="mt-3 space-y-2 border-l border-slate-200 pl-4">{report.labOrder.workflowEvents.map((event) => <li key={event.id} className="text-xs text-slate-600"><span className="font-semibold text-slate-800">{actionLabel[event.action] ?? event.action}</span> · {event.actor?.name ?? "System"} · {new Date(event.createdAt).toLocaleString()}{event.note && <span className="block text-slate-600">{event.note}</span>}</li>)}</ol></details>}
      </article>)}</div>}
    </Card>

    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !action.isPending) setEditing(null); }}><Card className="w-full max-w-2xl p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-slate-900">{editing.resultText ? "Update test result" : "Enter test result"}</h2><p className="mt-1 text-sm text-slate-600">{editing.labOrder.patient.name} · {editing.labOrder.diagnosticTest.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{editing.labOrder.id} · {editing.labOrder.sampleBarcode}</p></div><button type="button" aria-label="Close result editor" onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X size={18}/></button></div><form onSubmit={saveResult} className="mt-5 space-y-4"><label className="block text-sm font-medium text-slate-700">Result / findings<textarea required name="resultText" minLength={1} maxLength={12000} rows={10} defaultValue={editing.resultText ?? ""} placeholder="Enter the findings and relevant values. Include units and reference ranges where applicable." className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-900 outline-none focus:border-primary"/><span className="mt-1 block text-xs text-slate-600">Maximum 12,000 characters. Do not enter a result before confirming the sample barcode.</span></label>{action.isError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{action.error.message}</p>}<div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={action.isPending} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{action.isPending ? "Saving…" : "Save result"}</button></div></form></Card></div>}
    {smsTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !sendSms.isPending) setSmsTarget(null); }}><Card className="w-full max-w-md p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-slate-900">Notify patient by SMS?</h2><p className="mt-1 text-sm text-slate-600">{smsTarget.labOrder.patient.name} · {smsTarget.labOrder.patient.phone}</p></div><button type="button" aria-label="Close SMS confirmation" onClick={() => setSmsTarget(null)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X size={18}/></button></div><p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">This sends one real SMS and may incur a gateway charge. It contains the report reference and patient portal link, not the medical result.</p>{sendSms.isError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{sendSms.error.message}</p>}<div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setSmsTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button type="button" disabled={sendSms.isPending} onClick={() => sendSms.mutate(smsTarget)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><MessageSquare size={15}/>{sendSms.isPending ? "Sending…" : "Send SMS"}</button></div></Card></div>}
  </div></div>;
}
