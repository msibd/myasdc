"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { authClient } from "@/lib/auth-client";
import { useCentreName } from "@/components/centre-name";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  Stethoscope,
  Users,
  X,
} from "lucide-react";

const navigationGroups = [
  {
    label: "Workspace",
    items: [{ label: "Overview", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Patient care",
    items: [
      { label: "Patients", href: "/patients", icon: Users },
      { label: "Doctors", href: "/doctors", icon: Stethoscope },
      { label: "Appointments", href: "/appointments", icon: CalendarDays },
    ],
  },
  {
    label: "Diagnostics",
    items: [
      { label: "Lab workstation", href: "/lab-workstation", icon: FlaskConical },
      { label: "Reports", href: "/reports", icon: FileText, badge: "12" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Billing", href: "/billing", icon: CircleDollarSign },
      { label: "Inventory", href: "/inventory", icon: Package },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Analytics", href: "/analytics", icon: Activity },
    ],
  },
];

export function DashboardSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const session = authClient.useSession();
  const centreName = useCentreName().data?.name ?? "MediCore Diagnostics";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    setCollapsed((current) => !current);
  }

  const sidebarWidth = collapsed ? "lg:w-[5.25rem]" : "lg:w-64";
  const contentOffset = collapsed ? "lg:pl-[5.25rem]" : "lg:pl-64";

  return (
    <>
      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-[width,transform] duration-200 ease-in-out ${sidebarWidth} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className={`flex h-20 shrink-0 items-center gap-3 border-b border-slate-100 ${collapsed ? "justify-center px-2" : "px-3"}`}>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 lg:flex"
          >
            <ChevronDown size={18} className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : "rotate-90"}`} />
          </button>
          {!collapsed && <Link href="/" aria-label={`${centreName} dashboard`} className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-xl bg-primary p-2 text-white"><Stethoscope size={21} /></span>
            <span className="min-w-0"><span className="block truncate font-bold text-heading">{centreName}</span><span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-primary">Diagnostic Centre</span></span>
          </Link>}
          <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><X size={18} /></button>
        </div>

        <nav aria-label="Dashboard sections" className="flex-1 space-y-1 overflow-y-auto p-3">
          {navigationGroups.map((group, groupIndex) => (
            <section key={group.label} aria-label={group.label} className={groupIndex > 0 ? "mt-5" : undefined}>
              {!collapsed && <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{group.label}</h2>}
              <div className="space-y-1">
                {group.items.map(({ label, href, icon: Icon, badge }) => {
                  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${active ? "bg-primary-light text-primary-dark" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
                    >
                      <Icon size={18} className="shrink-0" />
                      {!collapsed && <><span className="min-w-0 flex-1 truncate">{label}</span>{badge && <span className="rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-semibold text-[#956000]">{badge}</span>}</>}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
          {session.data?.user?.role === "superadmin" && <section aria-label="Administration" className="mt-5">
            {!collapsed && <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Administration</h2>}
            <Link href="/staff" onClick={() => setMobileOpen(false)} title={collapsed ? "Staff management" : undefined} aria-current={pathname.startsWith("/staff") ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${pathname.startsWith("/staff") ? "bg-primary-light text-primary-dark" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <Users size={18} className="shrink-0" />{!collapsed && <span className="min-w-0 flex-1 truncate">Staff management</span>}
            </Link>
            <Link href="/settings" onClick={() => setMobileOpen(false)} title={collapsed ? "Centre settings" : undefined} aria-current={pathname === "/settings" ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${pathname === "/settings" ? "bg-primary-light text-primary-dark" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <Settings size={18} className="shrink-0" />{!collapsed && <span className="min-w-0 flex-1 truncate">Centre settings</span>}
            </Link>
          </section>}
        </nav>
      </aside>

      {mobileOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/30 backdrop-blur-[1px] lg:hidden" onClick={() => setMobileOpen(false)} />}
      <button type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="fixed bottom-5 left-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-blue-900/20 lg:hidden"><Menu size={20} /></button>
      <div className={`min-h-screen min-w-0 transition-[padding] duration-200 ease-in-out ${contentOffset}`}>
        {pathname !== "/" && <AppHeader />}
        {children}
      </div>
    </>
  );
}
