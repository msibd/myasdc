"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Beaker, Barcode, Check, Clock3, FlaskConical, Plus, Printer, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";

type Test = { id: string; name: string; department: string; price: string | number };
type Patient = { id: string; name: string; phone: string | null };
type Option = { id: string; name: string };
type Order = {
  id: string; status: string; testPrice: string | number; sampleBarcode: string | null; specimenType: string | null; sampleStatus: string; sampleCollectedAt: string | null; technicianAssignedAt: string | null; createdAt: string;
  patient: Patient; doctor: Option | null; technician: Option | null;
  diagnosticTest: Test;
  report: { id: string; status: string; resultText: string | null; resultEnteredAt: string | null; verifiedAt: string | null; approvedAt: string | null; deliveredAt: string | null } | null;
  invoice: { id: string; total: string | number; paid: string | number; status: string } | null;
};

async function getList<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json().catch(() => null) as T[] | { error?: string } | null;
  if (!response.ok) throw new Error(!Array.isArray(result) ? result?.error ?? "Unable to load records." : "Unable to load records.");
  return Array.isArray(result) ? result : [];
}

async function postAction<T>(url: string, method: string, payload: Record<string, string>): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(result?.error ?? "Unable to save workflow change.");
  return result as T;
}

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelClass = "block text-sm font-medium text-slate-700";
const CODE39: Record<string, string> = { "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn", A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn", K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn", U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn", Z: "nwwnwnnnn", "-": "nwnnnnwnw", "*": "nwnnwnwnn" };

function Code39({ value }: { value: string }) {
  const chars = `*${value}*`;
  let x = 4;
  const bars: { x: number; width: number }[] = [];
  for (let charIndex = 0; charIndex < chars.length; charIndex++) {
    const pattern = CODE39[chars[charIndex]];
    if (!pattern) continue;
    for (let index = 0; index < pattern.length; index++) {
      const width = pattern[index] === "w" ? 6 : 2;
      if (index % 2 === 0) bars.push({ x, width });
      x += width;
    }
    if (charIndex < chars.length - 1) x += 2;
  }
  return <svg className="h-12 w-full" viewBox={`0 0 ${x + 4} 52`} role="img" aria-label={`Code 39 barcode ${value}`} shapeRendering="crispEdges">{bars.map((bar, index) => <rect key={index} x={bar.x} y="2" width={bar.width} height="40" fill="#111827"/>)}<text x={(x + 8) / 2} y="51" textAnchor="middle" fontFamily="monospace" fontSize="9" fill="#111827">{value}</text></svg>;
}

export default function LabWorkstationPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collecting, setCollecting] = useState<Order | null>(null);
  const [labelOrder, setLabelOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTestId, setSelectedTestId] = useState("");
  const queryClient = useQueryClient();
  const tests = useQuery({ queryKey: ["diagnostic-tests"], queryFn: () => getList<Test>("/api/diagnostic-tests") });
  const orders = useQuery({ queryKey: ["lab-orders"], queryFn: () => getList<Order>("/api/lab-orders"), refetchInterval: 30_000 });
  const patients = useQuery({ queryKey: ["patients", "lab-options"], queryFn: async () => { const response = await fetch("/api/patients", { cache: "no-store" }); const result = await response.json().catch(() => null) as { patients?: Patient[]; error?: string } | null; if (!response.ok) throw new Error(result?.error ?? "Unable to load patients."); return result?.patients ?? []; } });
  const doctors = useQuery({ queryKey: ["doctors", "lab-options"], queryFn: async () => { const response = await fetch("/api/doctors", { cache: "no-store" }); const result = await response.json().catch(() => null) as { doctors?: Option[]; error?: string } | null; if (!response.ok) throw new Error(result?.error ?? "Unable to load doctors."); return result?.doctors ?? []; } });
  const technicians = useQuery({ queryKey: ["lab-technicians"], queryFn: () => getList<Option>("/api/lab-technicians") });
  const selectedTest = tests.data?.find((test) => test.id === selectedTestId);

  const createOrder = useMutation({
    mutationFn: (data: Record<string, string>) => postAction<Order>("/api/lab-orders", "POST", data),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["lab-orders"] }); await queryClient.invalidateQueries({ queryKey: ["billing"] }); setDialogOpen(false); setSelectedTestId(""); },
  });
  const updateOrder = useMutation({
    mutationFn: (data: Record<string, string>) => postAction<Order>("/api/lab-orders", "PATCH", data),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["lab-orders"] }); setCollecting(null); },
  });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("action") !== "new") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    window.history.replaceState(null, "", url);
    const timer = window.setTimeout(() => setDialogOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createOrder.mutate(Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>);
  }
  function submitCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!collecting) return;
    updateOrder.mutate({ ...Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>, action: "collect", id: collecting.id });
  }
  function printBarcodeLabel(order: Order) {
    setLabelOrder(order);
    document.body.classList.add("sample-barcode-print-mode");
    window.setTimeout(() => { window.print(); window.setTimeout(() => { document.body.classList.remove("sample-barcode-print-mode"); setLabelOrder(null); }, 800); }, 100);
  }

  const visibleTests = useMemo(() => (tests.data ?? []).filter((test) => `${test.name} ${test.department}`.toLowerCase().includes(search.toLowerCase())), [tests.data, search]);
  const visibleOrders = (orders.data ?? []).filter((order) => statusFilter === "all" || order.status === statusFilter);
  const processingCount = orders.data?.filter((order) => ["processing", "under_review"].includes(order.status)).length ?? 0;
  const sampleCount = orders.data?.filter((order) => order.status === "awaiting_sample").length ?? 0;
  const readyCount = orders.data?.filter((order) => ["ready", "delivered"].includes(order.status)).length ?? 0;

  return <div className="min-h-screen bg-surface p-5 sm:p-8"><div className="mx-auto max-w-[1400px]">
    <div className="mb-6 flex items-center justify-between gap-3"><div><Link href="/" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary"><ArrowLeft size={15}/> Dashboard</Link><h1 className="text-2xl font-bold text-slate-900">Lab workstation</h1><p className="mt-1 text-sm text-slate-600">Track orders, barcode-verify collected samples, and assign lab technicians.</p></div><button onClick={() => setDialogOpen(true)} className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"><Plus size={17}/> New test order</button></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-600">Awaiting sample</p><Barcode size={18} className="text-amber-600"/></div><p className="mt-2 text-2xl font-bold text-slate-900">{orders.isLoading ? "—" : sampleCount}</p></Card><Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-600">Lab processing / review</p><FlaskConical size={18} className="text-primary"/></div><p className="mt-2 text-2xl font-bold text-slate-900">{orders.isLoading ? "—" : processingCount}</p></Card><Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-600">Ready / delivered</p><Beaker size={18} className="text-emerald-600"/></div><p className="mt-2 text-2xl font-bold text-slate-900">{orders.isLoading ? "—" : readyCount}</p></Card></div>

    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Test order & sample queue</h2><p className="mt-1 text-xs text-slate-600">Each order has a unique barcode, linked invoice, and report record.</p></div><label className="flex items-center gap-2 text-sm font-medium text-slate-600">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter lab orders by status" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="all">All</option><option value="awaiting_sample">Awaiting sample</option><option value="processing">Processing</option><option value="under_review">Under review</option><option value="verified">Verified</option><option value="ready">Approved / ready</option><option value="delivered">Delivered</option></select></label></div>
        {orders.isError ? <div role="alert" className="p-8 text-center text-sm text-rose-700">{orders.error.message}<button onClick={() => void orders.refetch()} className="ml-2 font-semibold underline">Retry</button></div> : orders.isLoading ? <div className="space-y-3 p-5">{[0, 1, 2].map((key) => <div key={key} className="h-24 animate-pulse rounded-xl bg-slate-100"/>)}</div> : visibleOrders.length ? <div className="divide-y divide-slate-100">{visibleOrders.map((order) => <article key={order.id} className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary"><UserRound size={18}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{order.patient.name}<span className="ml-2 text-xs font-normal text-slate-500">{order.patient.phone ?? "No phone"}</span></p><p className="mt-1 text-xs text-slate-600">{order.diagnosticTest.name} · {order.diagnosticTest.department} · Dr. {order.doctor?.name ?? "not specified"}</p><p className="mt-1 break-all font-mono text-[11px] text-slate-500">Order {order.id} · Barcode {order.sampleBarcode ?? "not generated"}</p></div><Badge tone={order.status === "delivered" ? "green" : order.status === "awaiting_sample" ? "amber" : order.status === "ready" ? "green" : "blue"}>{order.status.replaceAll("_", " ")}</Badge></div>
          <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3"><div><span className="text-slate-600">Specimen: </span><strong className="text-slate-800">{order.specimenType ?? "Not recorded"}</strong></div><div><span className="text-slate-600">Technician: </span><strong className="text-slate-800">{order.technician?.name ?? "Unassigned"}</strong></div><div><span className="text-slate-600">Invoice: </span><strong className="text-slate-800">{order.invoice ? `${order.invoice.status} · BDT ${Number(order.invoice.paid).toFixed(2)}/${Number(order.invoice.total).toFixed(2)}` : "Not linked"}</strong></div></div>
          <div className="flex flex-wrap items-center gap-2">
            {order.status === "awaiting_sample" && <button onClick={() => { setCollecting(order); updateOrder.reset(); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark"><Barcode size={14}/> Scan & collect</button>}
            {order.sampleBarcode && <button onClick={() => printBarcodeLabel(order)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Printer size={14}/>Print label</button>}
            {!order.technician && !["ready", "delivered"].includes(order.status) && <label className="flex items-center gap-2 text-xs text-slate-600"><span className="sr-only">Assign technician to {order.patient.name}</span><select aria-label={`Technician for ${order.patient.name}`} defaultValue="" onChange={(event) => { if (event.target.value) updateOrder.mutate({ action: "assign", id: order.id, technicianId: event.target.value }); }} disabled={updateOrder.isPending || technicians.isLoading} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"><option value="">Assign technician…</option>{(technicians.data ?? []).map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}</select></label>}
            {order.report && <Link href="/reports" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Report: {order.report.status}</Link>}
            {order.invoice && <Link href="/billing" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Invoice {order.invoice.id.slice(0, 10)}</Link>}
            <span className="ml-auto text-[11px] text-slate-500">{order.sampleCollectedAt ? `Collected ${new Date(order.sampleCollectedAt).toLocaleString()}` : `Ordered ${new Date(order.createdAt).toLocaleString()}`}</span>
          </div>
        </article>)}</div> : <div className="p-10 text-center text-sm text-slate-600">No test orders match this status.</div>}</Card>

      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Diagnostic test catalogue</h2><p className="mt-1 text-xs text-slate-600">{tests.isLoading ? "Loading…" : `${visibleTests.length} active tests`}</p></div><div className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 text-slate-500"><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search diagnostic tests" className="w-28 bg-transparent text-xs outline-none" placeholder="Search tests"/></div></div>{tests.isError ? <div role="alert" className="p-6 text-sm text-rose-700">{tests.error.message}</div> : <div className="divide-y divide-slate-100">{visibleTests.map((test) => <div key={test.id} className="flex items-center gap-3 p-4"><div className="rounded-lg bg-slate-100 p-2 text-slate-600"><FlaskConical size={16}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{test.name}</p><p className="text-xs text-slate-600">{test.department}</p></div><p className="text-sm font-bold text-slate-800">৳ {Number(test.price).toLocaleString("en-BD")}</p></div>)}</div>}</Card>
    </div>

    {dialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !createOrder.isPending) setDialogOpen(false); }}><Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-slate-900">Register test order</h2><p className="mt-1 text-xs text-slate-600">Creates a barcode, invoice/payment record and report workflow entry.</p></div><button onClick={() => setDialogOpen(false)} aria-label="Close form" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X size={18}/></button></div><form onSubmit={submitOrder} className="mt-5 space-y-4">
      <label className={labelClass}>Patient<select required name="patientId" defaultValue="" className={inputClass}><option value="">Select patient</option>{(patients.data ?? []).map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.phone ?? "No phone"}</option>)}</select></label>
      <label className={labelClass}>Referring doctor (optional)<select name="doctorId" defaultValue="" className={inputClass}><option value="">Not specified</option>{(doctors.data ?? []).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Diagnostic test<select required name="diagnosticTestId" value={selectedTestId} onChange={(event) => setSelectedTestId(event.target.value)} className={inputClass}><option value="">Select test</option>{(tests.data ?? []).map((test) => <option key={test.id} value={test.id}>{test.name} · BDT {Number(test.price).toLocaleString()}</option>)}</select></label><label className={labelClass}>Specimen type<input required name="specimenType" maxLength={100} placeholder="e.g. EDTA whole blood" className={inputClass}/></label></div>
      <div className="grid gap-4 sm:grid-cols-3"><label className={labelClass}>Test price (BDT)<input readOnly value={selectedTest ? Number(selectedTest.price).toFixed(2) : ""} className={`${inputClass} bg-slate-50`}/></label><label className={labelClass}>Discount<input type="number" name="discount" min="0" max={selectedTest ? Math.max(0, Number(selectedTest.price) - 0.01) : undefined} step="0.01" defaultValue="0" className={inputClass}/></label><label className={labelClass}>Amount paid<input type="number" name="paid" min="0" max={selectedTest ? Number(selectedTest.price) : undefined} step="0.01" defaultValue="0" className={inputClass}/></label></div>
      <label className={labelClass}>Payment method<select name="paymentMethod" defaultValue="cash" className={inputClass}><option value="cash">Cash</option><option value="mobile_banking">Mobile banking</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></label>
      {createOrder.isError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{createOrder.error.message}</p>}
      <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">The system issues an invoice and tracks paid / partial / due automatically. Mapped reagent is deducted with FEFO during order registration.</p>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setDialogOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={createOrder.isPending || !patients.data?.length || !tests.data?.length} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{createOrder.isPending ? "Registering…" : "Create order & invoice"}</button></div>
    </form></Card></div>}

    {collecting && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !updateOrder.isPending) setCollecting(null); }}><Card className="w-full max-w-lg p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-slate-900">Scan and collect sample</h2><p className="mt-1 text-sm text-slate-600">{collecting.patient.name} · {collecting.diagnosticTest.name}</p></div><button type="button" onClick={() => setCollecting(null)} aria-label="Close sample collection" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X size={18}/></button></div><div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Expected barcode</p><p className="mt-1 break-all font-mono text-sm font-bold text-slate-900">{collecting.sampleBarcode}</p></div><form onSubmit={submitCollection} className="mt-4 space-y-4"><label className={labelClass}>Scan / enter barcode<input required name="barcode" autoFocus autoComplete="off" defaultValue="" placeholder="Scan the label barcode" className={`${inputClass} font-mono`}/></label><label className={labelClass}>Specimen type<input required name="specimenType" maxLength={100} defaultValue={collecting.specimenType ?? ""} placeholder="e.g. EDTA whole blood" className={inputClass}/></label>{updateOrder.isError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{updateOrder.error.message}</p>}<div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setCollecting(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={updateOrder.isPending} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Check size={15}/>{updateOrder.isPending ? "Recording…" : "Confirm collection"}</button></div></form></Card></div>}
    {labelOrder?.sampleBarcode && <article className="sample-barcode-print-sheet hidden" aria-label="Printable sample barcode label"><p className="text-center text-sm font-bold">{labelOrder.patient.name}</p><p className="mt-1 text-center text-xs">{labelOrder.diagnosticTest.name} · {labelOrder.specimenType ?? "Specimen"}</p><div className="mt-2"><Code39 value={labelOrder.sampleBarcode}/></div><p className="mt-1 text-center text-[10px]">Order: {labelOrder.id}</p></article>}
  </div></div>;
}
