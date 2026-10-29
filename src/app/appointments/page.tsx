"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock3, Plus, UserRound, X } from "lucide-react";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";

type Appointment = { id: string; date: string; time: string; status: string; patient: { name: string; phone: string | null }; doctor: { name: string; specialty: string | null } | null };
type Option = { id: string; name: string; specialty?: string | null };
type DoctorsResponse = { doctors: Option[] };
const fallback: Appointment[] = [
  { id: "1", date: "2026-10-27", time: "09:30 AM", status: "scheduled", patient: { name: "Ayesha Rahman", phone: "+880 1712-345678" }, doctor: { name: "Dr. Saif Hasan", specialty: "Medicine" } },
  { id: "2", date: "2026-10-27", time: "10:15 AM", status: "scheduled", patient: { name: "Tanvir Ahmed", phone: "+880 1812-987654" }, doctor: { name: "Dr. Nusrat Jahan", specialty: "Pathology" } },
  { id: "3", date: "2026-10-27", time: "11:45 AM", status: "completed", patient: { name: "Nusrat Sultana", phone: "+880 1911-123456" }, doctor: { name: "Dr. Arif Rahman", specialty: "Radiology" } },
];

async function getJson<T>(url: string, fallbackValue: T) { const response = await fetch(url); if (!response.ok) return fallbackValue; return response.json() as Promise<T>; }

export default function AppointmentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); });
  const queryClient = useQueryClient();
  const appointments = useQuery({ queryKey: ["appointments"], queryFn: () => getJson<Appointment[]>("/api/appointments", fallback), initialData: fallback });
  const patients = useQuery({ queryKey: ["patients", "options"], queryFn: async () => { const response = await fetch("/api/patients", { cache: "no-store" }); if (!response.ok) return []; const payload = await response.json() as { patients?: Option[] } | Option[]; return Array.isArray(payload) ? payload : payload.patients ?? []; }, initialData: [] });
  const doctors = useQuery({ queryKey: ["doctors"], queryFn: async () => { const response = await fetch("/api/doctors", { cache: "no-store" }); if (!response.ok) return []; const data = await response.json() as DoctorsResponse; return data.doctors; }, initialData: [] });
  const createAppointment = useMutation({ mutationFn: async (data: Record<string, string>) => { const response = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!response.ok) throw new Error("Unable to save appointment"); return response.json(); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["appointments"] }); setDialogOpen(false); } });

  useEffect(() => {
    let timer: number | undefined;
    if (new URLSearchParams(window.location.search).get("action") === "new") {
      const url = new URL(window.location.href);
      url.searchParams.delete("action");
      window.history.replaceState(null, "", url);
      timer = window.setTimeout(() => setDialogOpen(true), 0);
    }
    function openFromHeader(event: Event) {
      if ((event as CustomEvent<string>).detail === "appointment") setDialogOpen(true);
    }
    window.addEventListener("diagnostic:quick-action", openFromHeader);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("diagnostic:quick-action", openFromHeader);
    };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); createAppointment.mutate(Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>); }
  const visibleAppointments = appointments.data.filter((item) => item.date.slice(0, 10) === selectedDate);
  return <div className="min-h-screen bg-surface p-5 sm:p-8"><div className="mx-auto max-w-[1400px]">
    <div className="mb-6 flex items-center justify-between gap-3"><div><Link href="/" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary"><ArrowLeft size={15}/> Dashboard</Link><h1 className="text-2xl font-bold text-slate-900">Appointments</h1><p className="mt-1 text-sm text-slate-500">Schedule and manage patient visits with your clinical team.</p></div><button onClick={() => setDialogOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"><Plus size={17}/> New appointment</button></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><Card className="p-5"><p className="text-sm text-slate-500">Today&apos;s appointments</p><p className="mt-2 text-2xl font-bold text-slate-900">{appointments.data.filter((item) => item.date.startsWith("2026-10-27")).length || 86}</p></Card><Card className="p-5"><p className="text-sm text-slate-500">Upcoming this week</p><p className="mt-2 text-2xl font-bold text-slate-900">124</p></Card><Card className="p-5"><p className="text-sm text-slate-500">Completion rate</p><p className="mt-2 text-2xl font-bold text-emerald-600">94.6%</p></Card></div>
    <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Appointment schedule</h2><p className="mt-1 text-xs text-slate-500">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-BD", { dateStyle: "full" })}</p></div><div className="flex items-center gap-2"><label className="sr-only" htmlFor="appointment-date">Choose appointment date</label><input id="appointment-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"/><button type="button" onClick={() => { const now = new Date(); setSelectedDate(new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Today</button></div></div><div className="divide-y divide-slate-100">{visibleAppointments.length ? visibleAppointments.map((item) => <div key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="flex w-28 items-center gap-2 text-sm font-bold text-slate-600"><Clock3 size={16} className="text-primary"/>{item.time}</div><div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-primary"><UserRound size={18}/></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{item.patient.name}</p><p className="mt-1 text-xs text-slate-500">{item.patient.phone ?? "No phone"}</p></div><div className="min-w-48"><p className="text-sm font-medium text-slate-700">{item.doctor?.name ?? "Unassigned doctor"}</p><p className="mt-1 text-xs text-slate-500">{item.doctor?.specialty ?? "General consultation"}</p></div><Badge tone={item.status === "completed" ? "green" : "blue"}>{item.status}</Badge></div>) : <p className="p-10 text-center text-sm text-slate-500">No appointments scheduled for this date.</p>}</div></Card>
    {dialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"><Card className="w-full max-w-lg p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Create appointment</h2><p className="mt-1 text-xs text-slate-500">Reserve a time slot for a patient visit.</p></div><button onClick={() => setDialogOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-medium text-slate-700">Patient<select required name="patientId" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"><option value="">Select patient</option>{patients.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Doctor<select name="doctorId" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"><option value="">Assign later</option>{doctors.data.map((item) => <option key={item.id} value={item.id}>{item.name}{item.specialty ? ` · ${item.specialty}` : ""}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Date<input required type="date" name="date" defaultValue="2026-10-27" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"/></label><label className="block text-sm font-medium text-slate-700">Time<input required type="time" name="time" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"/></label></div><div className="flex justify-end gap-3 pt-3"><button type="button" onClick={() => setDialogOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button disabled={createAppointment.isPending} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{createAppointment.isPending ? "Saving..." : "Create appointment"}</button></div></form></Card></div>}
  </div></div>;
}
