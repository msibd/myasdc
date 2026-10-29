"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleDollarSign, FileText, Plus, Receipt, X } from "lucide-react";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { useCentreName } from "@/components/centre-name";

type Invoice = { id: string; subtotal?: string | number; discount?: string | number; total: string | number; paid: string | number; paymentMethod?: string; status: string; createdAt: string; patient: { name: string; phone: string | null }; labOrder?: { id: string; diagnosticTest: { name: string; department: string } } | null; payments: { amount: string | number; paymentMethod?: string; paidAt?: string }[] };
type Patient = { id: string; name: string; phone: string | null };
const fallback: Invoice[] = [
  { id: "INV-2026-0001", total: 2450, paid: 2450, status: "paid", createdAt: "2026-10-27T09:18:00Z", patient: { name: "Ayesha Rahman", phone: "+880 1712-345678" }, payments: [{ amount: 2450 }] },
  { id: "INV-2026-0002", total: 1850, paid: 850, status: "partial", createdAt: "2026-10-27T08:42:00Z", patient: { name: "Tanvir Ahmed", phone: "+880 1812-987654" }, payments: [{ amount: 850 }] },
];
async function getJson<T>(url: string, fallbackValue: T) { const response = await fetch(url); return response.ok ? response.json() as Promise<T> : fallbackValue; }

export default function BillingPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [subtotal, setSubtotal] = useState("");
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const queryClient = useQueryClient();
  const centreName = useCentreName().data?.name ?? "Diagnostic Centre";
  const invoices = useQuery({ queryKey: ["billing"], queryFn: () => getJson<Invoice[]>("/api/billing", fallback), initialData: fallback });
  const patients = useQuery({ queryKey: ["patients", "billing-options"], queryFn: async () => { const response = await fetch("/api/patients", { cache: "no-store" }); if (!response.ok) return []; const payload = await response.json() as { patients?: Patient[] } | Patient[]; return Array.isArray(payload) ? payload : payload.patients ?? []; }, initialData: [] });
  const mutation = useMutation({ mutationFn: async (data: Record<string, string>) => { const response = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new Error(body?.error ?? "Billing action failed"); } return response.json(); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["billing"] }); setDialogOpen(false); setPaymentInvoice(null); setSubtotal(""); setDiscount("0"); setPaymentMethod("cash"); } });
  useEffect(() => {
    let timer: number | undefined;
    if (new URLSearchParams(window.location.search).get("action") === "new") {
      const url = new URL(window.location.href);
      url.searchParams.delete("action");
      window.history.replaceState(null, "", url);
      timer = window.setTimeout(() => setDialogOpen(true), 0);
    }
    function openFromHeader(event: Event) {
      if ((event as CustomEvent<string>).detail === "billing") {
        setPaymentInvoice(null);
        setSubtotal("");
        setDiscount("0");
        setPaymentMethod("cash");
        setDialogOpen(true);
      }
    }
    window.addEventListener("diagnostic:quick-action", openFromHeader);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("diagnostic:quick-action", openFromHeader);
    };
  }, []);
  useEffect(() => {
    if (!printInvoice) return;
    document.body.classList.add("invoice-print-mode");
    const afterPrint = () => {
      document.body.classList.remove("invoice-print-mode");
      setPrintInvoice(null);
    };
    window.addEventListener("afterprint", afterPrint, { once: true });
    const timer = window.setTimeout(() => window.print(), 150);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", afterPrint);
      document.body.classList.remove("invoice-print-mode");
    };
  }, [printInvoice]);
  const totalCollected = invoices.data.reduce((sum, item) => sum + Number(item.paid), 0);
  const totalDue = invoices.data.reduce((sum, item) => sum + Number(item.total) - Number(item.paid), 0);
  const formatMoney = (amount: number) => `৳ ${amount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" }); };
  const netPayable = Math.max(0, (Number(subtotal) || 0) - (Number(discount) || 0));
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>; if (paymentInvoice) { data.action = "payment"; data.invoiceId = paymentInvoice.id; } else { data.action = "issue_and_collect"; } mutation.mutate(data); }
  return <div className="min-h-screen bg-surface p-5 sm:p-8"><div className="mx-auto max-w-[1400px]">
    <div className="mb-6 flex items-center justify-between gap-3"><div><Link href="/" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary"><ArrowLeft size={15}/> Dashboard</Link><h1 className="text-2xl font-bold text-slate-900">Billing</h1><p className="mt-1 text-sm text-slate-500">Manage invoices, payments and outstanding dues.</p></div><button onClick={() => { setPaymentInvoice(null); setSubtotal(""); setDiscount("0"); setPaymentMethod("cash"); mutation.reset(); setDialogOpen(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"><Plus size={17}/> New invoice</button></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">Collected</p><CircleDollarSign size={18} className="text-emerald-500"/></div><p className="mt-2 text-2xl font-bold text-slate-900">৳ {totalCollected.toLocaleString()}</p></Card><Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">Outstanding dues</p><Receipt size={18} className="text-amber-500"/></div><p className="mt-2 text-2xl font-bold text-slate-900">৳ {totalDue.toLocaleString()}</p></Card><Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">Invoices</p><FileText size={18} className="text-primary"/></div><p className="mt-2 text-2xl font-bold text-slate-900">{invoices.data.length}</p></Card></div>
    <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Invoice register</h2><p className="mt-1 text-xs text-slate-500">Latest billing activity</p></div><Badge tone="blue">{invoices.data.length} invoices</Badge></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Patient</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Paid</th><th className="px-5 py-3">Due</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{invoices.data.map((invoice) => <tr key={invoice.id} className="hover:bg-slate-50"><td className="px-5 py-4"><p className="text-sm font-semibold text-slate-800">{invoice.id}</p><p className="text-xs text-slate-500">{formatDate(invoice.createdAt)}</p></td><td className="px-5 py-4 text-sm text-slate-700">{invoice.patient.name}</td><td className="px-5 py-4 text-sm font-semibold text-slate-700">{formatMoney(Number(invoice.total))}</td><td className="px-5 py-4 text-sm text-emerald-700">{formatMoney(Number(invoice.paid))}</td><td className="px-5 py-4 text-sm font-semibold text-amber-700">{formatMoney(Math.max(0, Number(invoice.total) - Number(invoice.paid)))}</td><td className="px-5 py-4"><Badge tone={invoice.status === "paid" ? "green" : "amber"}>{invoice.status}</Badge></td><td className="px-5 py-4"><div className="flex items-center gap-2"><button type="button" onClick={() => setPrintInvoice(invoice)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><FileText size={14}/> Print</button>{invoice.status !== "paid" && <button onClick={() => setPaymentInvoice(invoice)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">Collect payment</button>}</div></td></tr>)}</tbody></table></div></Card>
    {printInvoice && <article className="invoice-print-sheet hidden" aria-label="Printable patient invoice">
      <header className="flex items-start justify-between border-b-2 border-slate-800 pb-5">
        <div><h1 className="text-2xl font-bold">{centreName}</h1><p className="mt-1 text-sm">Diagnostic Centre</p><p className="mt-5 text-lg font-bold">Patient invoice &amp; payment receipt</p></div>
        <div className="text-right text-sm"><p className="font-semibold">Invoice: {printInvoice.id}</p><p className="mt-1">Issued: {formatDate(printInvoice.createdAt)}</p><p className="mt-1">Status: {printInvoice.status}</p></div>
      </header>
      <section className="mt-6 grid grid-cols-2 gap-6 text-sm"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billed to</p><p className="mt-2 font-bold">{printInvoice.patient.name}</p><p className="mt-1">{printInvoice.patient.phone || "Phone not provided"}</p></div><div className="text-right"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment method</p><p className="mt-2 font-semibold">{(printInvoice.paymentMethod ?? printInvoice.payments?.[0]?.paymentMethod ?? "Not recorded").replaceAll("_", " ")}</p></div></section>
      <table className="mt-8 w-full border-collapse text-sm"><thead><tr className="border-y border-slate-300 text-left"><th className="py-3">Description</th><th className="py-3 text-right">Amount (BDT)</th></tr></thead><tbody><tr className="border-b border-slate-200"><td className="py-3">{printInvoice.labOrder ? `${printInvoice.labOrder.diagnosticTest.name} · ${printInvoice.labOrder.diagnosticTest.department}` : "Diagnostic services and tests"}</td><td className="py-3 text-right">{formatMoney(Number(printInvoice.subtotal ?? printInvoice.total) + Number(printInvoice.discount ?? 0))}</td></tr><tr><td className="py-2">Subtotal</td><td className="py-2 text-right">{formatMoney(Number(printInvoice.subtotal ?? Number(printInvoice.total) + Number(printInvoice.discount ?? 0)))}</td></tr><tr><td className="py-2">Discount</td><td className="py-2 text-right">− {formatMoney(Number(printInvoice.discount ?? 0))}</td></tr><tr className="border-t border-slate-300 font-bold"><td className="py-3">Net payable</td><td className="py-3 text-right">{formatMoney(Number(printInvoice.total))}</td></tr><tr><td className="py-2">Amount received</td><td className="py-2 text-right">{formatMoney(Number(printInvoice.paid))}</td></tr><tr className="font-bold"><td className="py-2">Balance due</td><td className="py-2 text-right">{formatMoney(Math.max(0, Number(printInvoice.total) - Number(printInvoice.paid)))}</td></tr></tbody></table>
      {printInvoice.payments?.length > 0 && <section className="mt-7"><h2 className="text-sm font-bold">Payment history</h2><table className="mt-2 w-full text-sm"><tbody>{printInvoice.payments.map((payment, index) => <tr key={`${payment.paidAt ?? "payment"}-${index}`} className="border-b border-slate-200"><td className="py-2">{payment.paidAt ? formatDate(payment.paidAt) : "Payment received"}</td><td className="py-2 capitalize">{(payment.paymentMethod ?? "Not recorded").replaceAll("_", " ")}</td><td className="py-2 text-right">{formatMoney(Number(payment.amount))}</td></tr>)}</tbody></table></section>}
      <footer className="mt-16 flex justify-between gap-12 text-center text-xs"><div className="w-56 border-t border-slate-500 pt-2">Patient / representative</div><div className="w-56 border-t border-slate-500 pt-2">Authorized cashier</div></footer><p className="mt-10 border-t border-slate-200 pt-3 text-center text-xs text-slate-500">Computer-generated receipt. Please retain this invoice for your records.</p>
    </article>}
    {(dialogOpen || paymentInvoice) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) { setDialogOpen(false); setPaymentInvoice(null); } }}>
      <Card className="w-full max-w-lg overflow-hidden rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4"><h2 className="text-base font-bold text-slate-800">{paymentInvoice ? "Collect payment" : "Generate Patient Invoice"}</h2><button type="button" aria-label="Close invoice dialog" onClick={() => { setDialogOpen(false); setPaymentInvoice(null); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={20}/></button></div>
        {paymentInvoice ? <form onSubmit={submit} className="mt-4 space-y-4"><p className="text-sm text-slate-600">Add a payment for {paymentInvoice.patient.name}.</p><label className="block text-sm font-medium text-slate-700">Payment amount (BDT)<input required type="number" min="0.01" step="0.01" name="amount" defaultValue={Number(paymentInvoice.total) - Number(paymentInvoice.paid)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-primary"/></label>{mutation.isError && <p role="alert" className="rounded-lg bg-danger-light p-3 text-sm text-[#8f3d2e]">{mutation.error.message}</p>}<div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => setPaymentInvoice(null)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={mutation.isPending} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{mutation.isPending ? "Collecting…" : "Collect payment"}</button></div></form> : <form onSubmit={submit} className="space-y-4 pt-4">
          <label className="block text-xs font-medium text-slate-600">Select Patient *<select required name="patientId" defaultValue="" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="" disabled>{patients.isLoading ? "Loading patients…" : "Select a patient"}</option>{patients.data.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} (P-{patient.id.slice(0, 6).toUpperCase()} · {patient.phone ?? "No phone"})</option>)}</select></label>
          <label className="block text-xs font-medium text-slate-600">Subtotal Amount (BDT) *<input required type="number" min="0.01" step="0.01" name="subtotal" value={subtotal} onChange={(event) => setSubtotal(event.target.value)} placeholder="1200" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"/></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-medium text-slate-600">Discount (BDT)<input type="number" min="0" max={subtotal || undefined} step="0.01" name="discount" value={discount} onChange={(event) => setDiscount(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"/></label><label className="block text-xs font-medium text-slate-600">Payment Method<select name="paymentMethod" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="cash">Cash</option><option value="mobile_banking">Mobile banking</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></label></div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-4"><span className="text-sm font-bold text-slate-800">Net Payable Amount:</span><strong className="text-lg font-extrabold text-[#b93c2b]">৳{netPayable.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong></div>
          {subtotal && Number(discount) > Number(subtotal) && <p role="alert" className="text-xs font-medium text-[#a64e3a]">Discount cannot exceed the subtotal.</p>}{mutation.isError && <p role="alert" className="rounded-lg bg-danger-light p-3 text-sm text-[#8f3d2e]">{mutation.error.message}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => { setDialogOpen(false); setSubtotal(""); setDiscount("0"); setPaymentMethod("cash"); mutation.reset(); }} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={mutation.isPending || !subtotal || netPayable <= 0 || Number(discount) > Number(subtotal) || patients.data.length === 0} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-55">{mutation.isPending ? "Issuing invoice…" : "Issue Invoice & Collect"}</button></div>
        </form>}
      </Card>
    </div>}
  </div></div>;
}
