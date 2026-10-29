"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, Eye, Pencil, Plus, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Patient = { id: string; name: string; phone: string | null; email: string | null; age: number | null; gender: string | null; bloodGroup: string | null; createdAt: string };
type PatientDetail = Patient & { _count: { appointments: number; labOrders: number; invoices: number }; labOrders: { id: string; createdAt: string; status: string; diagnosticTest: { name: string; department: string }; report: { status: string } | null }[] };
type PatientData = { patients: Patient[]; permissions: { canCreate: boolean; canView: boolean; canUpdate: boolean; canArchive: boolean } };
type FormValues = { name: string; phone: string; email: string; age: string; gender: string; bloodGroup: string };

class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function errorFrom(response: Response, fallback: string) {
  if (response.ok) return;
  const body = await response.json().catch(() => null) as { error?: string } | null;
  throw new ApiError(body?.error ?? fallback, response.status);
}

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [viewing, setViewing] = useState<Patient | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Patient | null>(null);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const directory = useQuery({
    queryKey: ["patients"],
    queryFn: async () => { const r = await fetch("/api/patients", { cache: "no-store", signal: AbortSignal.timeout(12_000) }); await errorFrom(r, "Patient directory could not be loaded."); return r.json() as Promise<PatientData>; },
    retry: (failureCount, reason) => reason instanceof ApiError ? reason.status >= 500 && failureCount < 1 : failureCount < 1,
  });
  const detail = useQuery({
    queryKey: ["patient", viewing?.id], enabled: Boolean(viewing),
    queryFn: async () => { const r = await fetch(`/api/patients/${viewing!.id}`, { cache: "no-store", signal: AbortSignal.timeout(12_000) }); await errorFrom(r, "Patient details could not be loaded."); return r.json() as Promise<PatientDetail>; },
    retry: (failureCount, reason) => reason instanceof ApiError ? reason.status >= 500 && failureCount < 1 : failureCount < 1,
  });
  const save = useMutation({ mutationFn: async ({ data, id }: { data: FormValues; id?: string }) => { const r = await fetch(id ? `/api/patients/${id}` : "/api/patients", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); await errorFrom(r, "Unable to save patient."); return r.json(); }, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["patients"] }); setFormOpen(false); setEditing(null); setError(""); }, onError: (e) => setError(e.message) });
  const archive = useMutation({ mutationFn: async (patient: Patient) => { const r = await fetch(`/api/patients/${patient.id}`, { method: "DELETE" }); await errorFrom(r, "Unable to archive patient."); }, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["patients"] }); setError(""); }, onError: (e) => setError(e.message) });
  const patients = directory.data?.patients ?? [];
  const permissions = directory.data?.permissions;
  const filtered = patients.filter((p) => `${p.name} ${p.phone ?? ""} ${p.email ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!directory.data || new URLSearchParams(window.location.search).get("action") !== "new") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    window.history.replaceState(null, "", url);
    const timer = window.setTimeout(() => {
      if (permissions?.canCreate) {
        setEditing(null);
        setError("");
        setFormOpen(true);
      } else {
        setError("Your account does not have permission to register patients.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [directory.data, permissions?.canCreate]);

  useEffect(() => {
    function openFromHeader(event: Event) {
      if ((event as CustomEvent<string>).detail !== "patient") return;
      if (!permissions?.canCreate) {
        setError("Your account does not have permission to register patients.");
        return;
      }
      setEditing(null);
      setError("");
      setFormOpen(true);
    }
    window.addEventListener("diagnostic:quick-action", openFromHeader);
    return () => window.removeEventListener("diagnostic:quick-action", openFromHeader);
  }, [permissions?.canCreate]);

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); save.mutate({ data: Object.fromEntries(new FormData(event.currentTarget).entries()) as FormValues, id: editing?.id }); }
  function openEdit(patient: Patient) { setEditing(patient); setError(""); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); }

  return <main className="min-h-screen bg-surface p-5 sm:p-8"><div className="mx-auto max-w-[1400px]">
    <div className="mb-6 flex items-center justify-between gap-3"><div><Link href="/" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary"><ArrowLeft size={15}/> Dashboard</Link><h1 className="text-2xl font-bold text-slate-900">Patients</h1><p className="mt-1 text-sm text-slate-600">Register and manage diagnostic centre patients.</p></div>{permissions?.canCreate && <button onClick={() => { setEditing(null); setError(""); setFormOpen(true); }} className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"><Plus size={17}/> New patient</button>}</div>
    {error && <div role="alert" className="mb-4 flex justify-between rounded-xl border border-danger/30 bg-danger-light p-3 text-sm text-[#8f3d2e]">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={16}/></button></div>}
    <Card className="overflow-hidden"><div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center"><div><h2 className="font-bold text-slate-900">Patient directory</h2><p className="mt-1 text-xs text-slate-600">{directory.isLoading ? "Loading patients…" : `${filtered.length} patients shown`}</p></div><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"><Search size={16}/><span className="sr-only">Search patients</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patients..." className="w-48 bg-transparent outline-none placeholder:text-slate-500"/></label></div>
      {directory.isError ? <div role="alert" className="p-10 text-center text-sm text-[#8f3d2e]"><p>{directory.error.message}</p>{directory.error instanceof ApiError && directory.error.status === 401 ? <Link href="/login" className="mt-2 inline-block font-semibold text-primary underline">Sign in again</Link> : <button onClick={() => directory.refetch()} className="mt-2 font-semibold underline">Retry</button>}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"><tr>{["Patient", "Contact", "Age / gender", "Blood group", "Registered", "Status", "Actions"].map((x) => <th key={x} className="px-5 py-3">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{directory.isLoading ? <tr><td colSpan={7} className="p-10 text-center text-sm text-slate-600">Loading patient records…</td></tr> : filtered.map((p) => <tr key={p.id} className="hover:bg-slate-50"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-primary-dark"><UserRound size={16}/></div><div><p className="text-sm font-semibold text-slate-900">{p.name}</p><p className="text-xs text-slate-600">#{p.id.slice(0, 8)}</p></div></div></td><td className="px-5 py-4"><p className="text-sm text-slate-700">{p.phone ?? "—"}</p><p className="text-xs text-slate-600">{p.email ?? "No email"}</p></td><td className="px-5 py-4 text-sm text-slate-700">{p.age ?? "—"}{p.gender ? ` · ${p.gender}` : ""}</td><td className="px-5 py-4"><Badge tone="rose">{p.bloodGroup ?? "Unknown"}</Badge></td><td className="px-5 py-4 text-sm text-slate-600">{new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td><td className="px-5 py-4"><Badge tone="green">Active</Badge></td><td className="px-5 py-4"><div className="flex justify-end gap-1">{permissions?.canView && <button onClick={() => setViewing(p)} aria-label={`View ${p.name}`} title="View details" className="rounded-lg p-2 text-slate-600 hover:bg-primary-light hover:text-primary-dark"><Eye size={16}/></button>}{permissions?.canUpdate && <button onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`} title="Edit patient" className="rounded-lg p-2 text-slate-600 hover:bg-primary-light hover:text-primary-dark"><Pencil size={16}/></button>}{permissions?.canArchive && <button onClick={() => setArchiveTarget(p)} disabled={archive.isPending} aria-label={`Archive ${p.name}`} title="Archive patient" className="rounded-lg p-2 text-slate-600 hover:bg-danger-light hover:text-[#a64e3a]"><Archive size={16}/></button>}</div></td></tr>)}{!directory.isLoading && filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-sm text-slate-600">{patients.length ? "No patients match the search." : "No active patient records."}</td></tr>}</tbody></table></div>}</Card>

    {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeForm(); }}><Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">{editing ? "Edit patient" : "Register new patient"}</h2><p className="mt-1 text-xs text-slate-600">{editing ? "Update contact and demographic information." : "Add basic information to create a patient record."}</p></div><button onClick={closeForm} aria-label="Close form" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X size={18}/></button></div><form key={editing?.id ?? "new"} onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-medium text-slate-700">Full name<input required name="name" maxLength={160} defaultValue={editing?.name} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-primary"/></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Phone<input name="phone" maxLength={32} defaultValue={editing?.phone ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-primary"/></label><label className="block text-sm font-medium text-slate-700">Email<input type="email" name="email" defaultValue={editing?.email ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-primary"/></label></div><div className="grid gap-4 sm:grid-cols-3"><label className="block text-sm font-medium text-slate-700">Age<input type="number" name="age" min="0" max="130" defaultValue={editing?.age ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-primary"/></label><label className="block text-sm font-medium text-slate-700">Gender<select name="gender" defaultValue={editing?.gender ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-primary"><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></label><label className="block text-sm font-medium text-slate-700">Blood group<select name="bloodGroup" defaultValue={editing?.bloodGroup ?? ""} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-primary"><option value="">Select</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => <option key={g}>{g}</option>)}</select></label></div>{error && <p role="alert" className="rounded-xl bg-danger-light p-3 text-sm text-[#8f3d2e]">{error}</p>}<div className="flex justify-end gap-3 pt-2"><button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={save.isPending} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{save.isPending ? "Saving…" : editing ? "Save changes" : "Create patient"}</button></div></form></Card></div>}

    {viewing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setViewing(null); }}><Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Patient record</p><h2 className="mt-1 text-xl font-bold text-slate-900">{viewing.name}</h2><p className="mt-1 text-sm text-slate-600">Record ID: {viewing.id}</p></div><button onClick={() => setViewing(null)} aria-label="Close details" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X size={18}/></button></div>{detail.isLoading ? <p className="py-10 text-center text-sm text-slate-600">Loading details…</p> : detail.isError ? <p role="alert" className="mt-5 bg-danger-light p-3 text-sm text-[#8f3d2e]">{detail.error.message}</p> : detail.data && <><div className="mt-5 grid gap-3 sm:grid-cols-2">{[["Phone", detail.data.phone], ["Email", detail.data.email], ["Age / gender", [detail.data.age, detail.data.gender].filter(Boolean).join(" · ")], ["Blood group", detail.data.bloodGroup], ["Registered", new Date(detail.data.createdAt).toLocaleString("en-GB")]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-600">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{value || "Not provided"}</p></div>)}</div><div className="mt-4 grid grid-cols-3 gap-3">{[["Appointments", detail.data._count.appointments], ["Lab orders", detail.data._count.labOrders], ["Invoices", detail.data._count.invoices]].map(([label, value]) => <div key={label} className="rounded-xl bg-surface p-3"><p className="text-xs text-slate-600">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{value}</p></div>)}</div><h3 className="mt-5 text-sm font-bold text-slate-900">Recent lab orders</h3>{detail.data.labOrders.length ? <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">{detail.data.labOrders.map((o) => <div key={o.id} className="flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-semibold text-slate-800">{o.diagnosticTest.name}</p><p className="text-xs text-slate-600">{o.diagnosticTest.department} · {new Date(o.createdAt).toLocaleDateString("en-GB")}</p></div><Badge tone={o.report?.status === "verified" ? "green" : "amber"}>{o.report?.status ?? o.status}</Badge></div>)}</div> : <p className="mt-2 text-sm text-slate-600">No lab orders found.</p>}</>}<div className="mt-6 flex justify-end"><button onClick={() => setViewing(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Close</button></div></Card></div>}
    <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive patient?</AlertDialogTitle>
          <AlertDialogDescription>
            {archiveTarget ? `${archiveTarget.name} will be removed from the active directory. Existing appointments, lab results and billing history will be retained.` : "This patient will be removed from the active directory."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archive.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!archiveTarget || archive.isPending} onClick={() => { if (archiveTarget) archive.mutate(archiveTarget); }}>
            {archive.isPending ? "Archiving…" : "Archive patient"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div></main>;
}
