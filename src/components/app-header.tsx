"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarDays, ChevronDown, CircleDollarSign, Search, Users } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui";
import { useTheme } from "next-themes";
import { useCentreName } from "@/components/centre-name";

type HeaderSummary = { pendingReports: number; billingDueCount: number; lowStockCount: number };
type Appearance = "light" | "dark" | "system";

function AppearanceIcon({ mode }: { mode: Appearance }) {
  if (mode === "light") return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>;
  if (mode === "dark") return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 14.2A8.8 8.8 0 0 1 9.8 3.2 8.8 8.8 0 1 0 20.8 14.2Z"/></svg>;
  return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>;
}

async function getHeaderSummary() {
  const response = await fetch("/api/dashboard?period=today");
  if (!response.ok) throw new Error("Alerts are unavailable");
  return response.json() as Promise<HeaderSummary>;
}

export function AppHeader() {
  const { theme, setTheme } = useTheme();
  const centreName = useCentreName().data?.name ?? "MediCore Diagnostics";
  const router = useRouter();
  const session = authClient.useSession();
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const alerts = useQuery({ queryKey: ["dashboard", "today"], queryFn: getHeaderSummary, refetchInterval: 60_000 });
  const firstName = session.data?.user?.name?.trim().split(/\s+/)[0] || "there";
  const initials = (session.data?.user?.name ?? "Staff").split(" ").map((part) => part[0]).join("").slice(0, 2);
  const summary = alerts.data;

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (query) router.push(`/patients?q=${encodeURIComponent(query)}`);
  }

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
  }

  return (
    <header className="relative z-30 flex min-h-20 flex-col justify-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 xl:px-8">
      <div className="min-w-0">
        <p className="text-xs font-medium text-body">{centreName}</p>
        <h1 className="truncate text-lg font-bold text-heading sm:text-xl">Welcome back, {firstName} <span aria-hidden="true">👋</span></h1>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
        <form onSubmit={submitSearch} role="search" className="flex min-w-[170px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 sm:max-w-64">
          <Search size={16} className="shrink-0" />
          <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patients..." aria-label="Search patients" className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400" />
          <kbd className="hidden shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-400 md:inline">Ctrl K</kbd>
        </form>

        <nav aria-label="Quick actions" className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Link href="/patients?action=new" onClick={() => window.dispatchEvent(new CustomEvent("diagnostic:quick-action", { detail: "patient" }))} title="Register a patient" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:px-3 sm:text-sm"><Users size={15}/><span>New patient</span></Link>
          <Link href="/appointments?action=new" onClick={() => window.dispatchEvent(new CustomEvent("diagnostic:quick-action", { detail: "appointment" }))} title="Schedule an appointment" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 sm:px-3 sm:text-sm"><CalendarDays size={15}/><span>Appointment</span></Link>
          <Link href="/billing?action=new" onClick={() => window.dispatchEvent(new CustomEvent("diagnostic:quick-action", { detail: "billing" }))} title="Create a quick bill" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 sm:px-3 sm:text-sm"><CircleDollarSign size={15}/><span>Quick bill</span></Link>
        </nav>

        <div className="relative">
          <button type="button" onClick={() => { setNotificationsOpen((open) => !open); setProfileOpen(false); }} aria-label="Notifications" aria-expanded={notificationsOpen} title="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600">
            <Bell size={18} />
            {((summary?.pendingReports ?? 0) + (summary?.billingDueCount ?? 0) + (summary?.lowStockCount ?? 0)) > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />}
          </button>
          {notificationsOpen && <div className="absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            <p className="px-3 py-2 text-sm font-semibold text-slate-800">Centre alerts</p>
            <Link href="/reports" onClick={() => setNotificationsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm hover:bg-slate-50"><span>Reports awaiting review</span><Badge tone="amber">{summary?.pendingReports ?? "—"}</Badge></Link>
            <Link href="/billing" onClick={() => setNotificationsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm hover:bg-slate-50"><span>Invoices due</span><Badge tone="rose">{summary?.billingDueCount ?? "—"}</Badge></Link>
            <Link href="/inventory" onClick={() => setNotificationsOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm hover:bg-slate-50"><span>Low-stock items</span><Badge tone="blue">{summary?.lowStockCount ?? "—"}</Badge></Link>
          </div>}
        </div>

        <div className="relative">
          <button type="button" onClick={() => { setProfileOpen((open) => !open); setNotificationsOpen(false); }} aria-label="Open profile menu" aria-expanded={profileOpen} className="flex h-10 items-center gap-1.5 rounded-xl p-1 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary-dark">{initials}</span><ChevronDown size={15} className="text-slate-400" />
          </button>
          {profileOpen && <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            <div className="border-b border-slate-100 px-3 py-2"><p className="truncate text-sm font-semibold text-slate-800">{session.data?.user?.name ?? "Staff member"}</p><p className="truncate text-xs text-slate-500">{session.data?.user?.email}</p></div>
            <Link href="/profile" onClick={() => setProfileOpen(false)} className="mt-1 block w-full rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Profile management</Link>
            <div className="border-t border-slate-100 px-3 pb-2 pt-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">Appearance</p>
              <div role="group" aria-label="Choose appearance" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50 p-1">
                {([{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }] as const).map(({ value, label }) => <button key={value} type="button" onClick={() => setTheme(value)} aria-pressed={theme === value} className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition-colors ${theme === value ? "bg-white text-primary-dark shadow-sm" : "text-slate-600 hover:text-slate-900"}`}><AppearanceIcon mode={value} />{label}</button>)}
              </div>
            </div>
            <button type="button" onClick={signOut} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50">Logout</button>
          </div>}
        </div>
      </div>
    </header>
  );
}
