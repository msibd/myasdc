"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, ArrowUpRight, ChevronDown, CircleDollarSign,
  ClipboardList, Clock3, FileText, Package, ShieldCheck, Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card } from "@/components/ui";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { AppHeader } from "@/components/app-header";

type Period = "today" | "week" | "month";
type DashboardData = {
  totalPatients: number;
  todayPatients: number;
  todayAppointments: number;
  testsToday: number;
  revenue: number;
  pendingReports: number;
  billingDueCount: number;
  lowStockCount: number;
  lowStockItems: { id: string; name: string; quantity: number; reorderLevel: number; unit: string }[];
  pendingReportSamples: { id: string; labOrder: { patient: { name: string }; diagnosticTest: { name: string } } }[];
  ready: number;
  processing: number;
  verifiedReports: number;
  weeklyTests: { day: string; count: number }[];
};
type AppointmentRow = { id: string; date: string; time: string; status: string; patient: { name: string }; doctor: { name: string } | null };
type ReportRow = { id: string; status: string; labOrder: { createdAt: string; patient: { name: string }; diagnosticTest: { name: string } } };

const periodLabels: Record<Period, string> = { today: "Today", week: "This week", month: "This month" };

async function getDashboard(period: Period): Promise<DashboardData> {
  const response = await fetch(`/api/dashboard?period=${period}`);
  if (!response.ok) throw new Error("Dashboard data is unavailable. Please retry.");
  return response.json();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 }).format(value);
}

function formatReportDate(value: string | undefined) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function StatCard({ label, value, icon: Icon, note, href }: { label: string; value: string; icon: typeof Users; note: string; href: string }) {
  return (
    <Link href={href} className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><Card className="min-h-[150px] min-w-0 p-4 transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary-dark"><Icon size={19} /></div>
        <span className="flex items-center gap-1 text-right text-xs font-semibold text-body">{note}<ArrowUpRight size={13}/></span>
      </div>
      <p className="mt-4 text-sm font-medium text-body">{label}</p>
      <p className="mt-1 truncate text-2xl font-bold tracking-tight text-heading">{value}</p>
    </Card></Link>
  );
}

export default function Home() {
  const [period, setPeriod] = useState<Period>("today");
  const [downloadStatus, setDownloadStatus] = useState("");
  const dashboard = useQuery({ queryKey: ["dashboard", period], queryFn: () => getDashboard(period), refetchInterval: 60_000 });
  const appointments = useQuery({
    queryKey: ["appointments", "dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/appointments?date=today&limit=4");
      if (!response.ok) throw new Error("Appointments unavailable");
      return response.json() as Promise<AppointmentRow[]>;
    },
  });
  const reports = useQuery({
    queryKey: ["reports", "dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/reports?limit=3");
      if (!response.ok) throw new Error("Reports unavailable");
      const result = await response.json() as { reports?: ReportRow[] };
      return result.reports ?? [];
    },
  });
  const data = dashboard.data;

  function downloadSnapshot() {
    if (!data) {
      setDownloadStatus("Dashboard data is still loading. Retrying…");
      void dashboard.refetch();
      return;
    }
    const rows = [
      ["Metric", "Value"],
      ["Period", periodLabels[period]],
      ["Total patients", data.totalPatients],
      ["Appointments", data.todayAppointments],
      ["Test orders", data.testsToday],
      ["Revenue collected", data.revenue],
      ["Pending reports", data.pendingReports],
      ["Low-stock items", data.lowStockCount],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `diagnostic-dashboard-${period}.csv`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setDownloadStatus("Dashboard summary downloaded.");
    window.setTimeout(() => setDownloadStatus(""), 3_000);
  }

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-surface">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:space-y-6 sm:p-6 xl:p-8">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div><p className="text-xs font-medium text-slate-600">Home <span className="px-1.5 text-slate-400">›</span> Overview</p><h2 className="mt-1 text-2xl font-bold text-slate-900">Dashboard Overview</h2><p className="mt-1 text-sm text-slate-600">Here&apos;s what&apos;s happening at your centre today.</p></div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <label className="sr-only" htmlFor="dashboard-period">Dashboard date range</label>
            <span className="relative"><select id="dashboard-period" value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="h-10 appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">{Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-slate-400" /></span>
            <button type="button" onClick={downloadSnapshot} aria-label="Download dashboard summary CSV" title={data ? "Download dashboard summary CSV" : "Retry dashboard data, then download the summary"} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-primary hover:bg-primary-light hover:text-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><ClipboardList size={16} /></button>
          </div>
        </div>

        <p aria-live="polite" className="sr-only">{downloadStatus}</p>

        {dashboard.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><span>{dashboard.error.message}</span><button type="button" onClick={() => dashboard.refetch()} className="font-semibold underline">Retry</button></div>}

        <section aria-label="Centre summary" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
          <StatCard label="Today's patients" value={data ? data.todayPatients.toLocaleString() : "—"} icon={Users} note="View directory" href="/patients" />
          <StatCard label="Pending test reports" value={data ? data.pendingReports.toLocaleString() : "—"} icon={FileText} note="Process reports" href="/reports" />
          <StatCard label="Ready lab orders" value={data ? data.ready.toLocaleString() : "—"} icon={ShieldCheck} note="Lab workstation" href="/lab-workstation" />
          <StatCard label={`${periodLabels[period]} revenue`} value={data ? formatCurrency(data.revenue) : "—"} icon={CircleDollarSign} note="Billing ledger" href="/billing" />
        </section>

        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5"><div><h3 className="font-bold text-slate-900">Sample processing lifecycle</h3><p className="mt-1 text-xs text-slate-600">Live counts from the current lab and report workflow</p></div><Link href="/lab-workstation" className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100">Open lab workstation →</Link></div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
            {[
              { label: "Lab analysis", value: data?.processing, stage: "Stage 1", icon: Activity, color: "bg-blue-600" },
              { label: "Reports pending review", value: data?.pendingReports, stage: "Stage 2", icon: Clock3, color: "bg-amber-500" },
              { label: "Reports verified", value: data?.verifiedReports, stage: "Stage 3", icon: ShieldCheck, color: "bg-violet-600" },
              { label: "Ready to deliver", value: data?.ready, stage: "Stage 4", icon: FileText, color: "bg-emerald-700" },
            ].map(({ label, value, stage, icon: Icon, color }) => <div key={label} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color} text-white`}><Icon size={19}/></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{stage}</p><p className="truncate text-sm font-bold text-slate-900">{label}</p></div><span className="ml-auto text-xl font-black text-slate-900">{value ?? "—"}</span></div>)}
          </div>
        </Card>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[1.8fr_1fr] xl:gap-5">
          <Card className="min-w-0 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4 sm:p-5"><div><h3 className="font-bold text-slate-900">Daily test orders</h3><p className="mt-1 text-xs text-slate-500">Last seven days · live from lab orders</p></div><Badge tone="blue">{data?.testsToday ?? "—"} in selected period</Badge></div>
            {dashboard.isLoading ? <div className="h-56 animate-pulse bg-slate-50" aria-label="Loading chart" /> : data?.weeklyTests.length ? <div className="p-4 sm:p-5"><ChartContainer className="h-[210px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.weeklyTests} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="day" tickFormatter={(value: string) => new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "Asia/Dhaka" }).format(new Date(value))} tick={{ fontSize: 12, fill: "var(--text-body)", fontWeight: 500 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} width={36} tick={{ fontSize: 12, fill: "var(--text-body)", fontWeight: 500 }} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltipContent />} /><Bar dataKey="count" name="Orders" fill="var(--primary-dark)" radius={[6, 6, 0, 0]} maxBarSize={34} /></BarChart></ResponsiveContainer></ChartContainer></div> : <div className="flex h-56 items-center justify-center text-sm text-slate-400">No test orders recorded this week.</div>}
          </Card>

          <Card className="min-w-0 overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5"><div className="flex items-center gap-2"><Activity size={18} className="text-rose-600"/><div><h3 className="font-bold text-slate-900">Operational alerts</h3><p className="mt-0.5 text-xs text-slate-600">Items that need staff attention</p></div></div><Badge tone={(data?.pendingReports ?? 0) + (data?.lowStockCount ?? 0) > 0 ? "rose" : "green"}>{(data?.pendingReports ?? 0) + (data?.lowStockCount ?? 0) > 0 ? "Action needed" : "All clear"}</Badge></div>
            <div className="space-y-3 p-4 sm:p-5">
              {dashboard.isLoading ? <div className="h-36 animate-pulse rounded-xl bg-slate-50" aria-label="Loading alerts" /> : <>
                {(data?.pendingReportSamples ?? []).slice(0, 2).map((report) => <Link key={report.id} href="/reports" className="block rounded-xl border border-amber-200 bg-amber-50 p-3 transition hover:bg-amber-100"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-900">Report awaiting review</span><span className="text-[10px] text-slate-600">{report.id}</span></div><p className="mt-1 truncate text-xs font-semibold text-amber-900">{report.labOrder.patient.name} · {report.labOrder.diagnosticTest.name}</p><span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-amber-800">Review report <ArrowUpRight size={12}/></span></Link>)}
                {(data?.lowStockItems ?? []).slice(0, 2).map((item) => <Link key={item.id} href="/inventory" className="block rounded-xl border border-rose-200 bg-rose-50 p-3 transition hover:bg-rose-100"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-900">Low stock · {item.name}</span><Package size={14} className="text-rose-700"/></div><p className="mt-1 text-xs font-semibold text-rose-800">{item.quantity} {item.unit} remaining · reorder level {item.reorderLevel}</p><span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-rose-800">Open inventory <ArrowUpRight size={12}/></span></Link>)}
                {(data?.pendingReports ?? 0) + (data?.lowStockCount ?? 0) === 0 && <div className="flex min-h-36 flex-col items-center justify-center text-center"><ShieldCheck size={26} className="text-emerald-600"/><p className="mt-2 text-sm font-semibold text-slate-900">No outstanding operational alerts</p><p className="mt-1 text-xs text-slate-600">Reports and stock levels are up to date.</p></div>}
              </>}
            </div>
          </Card>
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[1.2fr_1fr] xl:gap-5">
          <Card className="min-w-0 overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5"><div><h3 className="font-bold text-slate-900">Upcoming appointments</h3><p className="mt-1 text-xs text-slate-500">Your schedule for today</p></div><Link href="/appointments" className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-primary hover:bg-blue-50">View all</Link></div><div className="divide-y divide-slate-100">{appointments.isLoading ? <div className="h-48 animate-pulse bg-slate-50" aria-label="Loading appointments" /> : appointments.data?.length ? appointments.data.map((item) => <div className="flex min-w-0 items-center gap-2.5 p-3 sm:gap-4 sm:p-4" key={item.id}><div className="w-16 shrink-0 text-[11px] font-bold text-slate-500 sm:text-xs">{item.time}</div><div className="hidden h-9 w-9 shrink-0 rounded-full bg-slate-100 text-center text-sm font-bold leading-9 text-slate-600 sm:block">{item.patient.name.split(" ").map((name) => name[0]).join("")}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{item.patient.name}</p><p className="truncate text-xs text-slate-500">{item.doctor?.name ?? "Doctor unassigned"}</p></div><Badge tone={item.status === "completed" ? "green" : "blue"}>{item.status}</Badge></div>) : <div className="p-8 text-center text-sm text-slate-400">{appointments.isError ? "Appointments could not be loaded." : "No appointments scheduled for today."}</div>}</div></Card>

          <Card className="min-w-0 overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5"><div><h3 className="font-bold text-slate-900">Recent reports</h3><p className="mt-1 text-xs text-slate-500">Latest report activity</p></div><Link href="/reports" className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-primary hover:bg-blue-50">View all</Link></div><div className="divide-y divide-slate-100">{reports.isLoading ? <div className="h-48 animate-pulse bg-slate-50" aria-label="Loading reports" /> : reports.data?.length ? reports.data.map((report) => <div className="p-3.5 sm:p-4" key={report.id}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{report.labOrder.patient.name}</p><p className="mt-1 truncate text-xs text-slate-500">{report.labOrder.diagnosticTest.name}</p></div><Badge tone={report.status === "verified" ? "green" : "amber"}>{report.status === "verified" ? "Verified" : "Pending review"}</Badge></div><p className="mt-2 text-[11px] text-slate-400">{report.id} · {formatReportDate(report.labOrder.createdAt)}</p></div>) : <div className="p-8 text-center text-sm text-slate-400">{reports.isError ? "Reports could not be loaded." : "No reports available yet."}</div>}</div></Card>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5 text-sm text-blue-900 sm:p-4"><div className="flex items-center gap-3"><ShieldCheck size={20} className="shrink-0 text-blue-600" /><span><strong>System health:</strong> All services are operating normally.</span></div><span className="text-xs font-semibold text-blue-600">{dashboard.isFetching ? "Refreshing…" : "Live dashboard data"}</span></div>
      </main>
    </div>
  );
}
