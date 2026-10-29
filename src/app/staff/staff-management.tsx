"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { ArrowLeft, ChevronDown, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { roleLabels, rolePermissions } from "@/auth/role-permissions";

const PermissionMatrix = dynamicImport(() => import("@/components/permission-matrix").then((module) => module.PermissionMatrix), { loading: () => <div className="h-96 animate-pulse bg-slate-50"/> });

type Role = keyof typeof rolePermissions;
type Staff = { id: string; name: string; email: string; role: string | null; banned: boolean | null; createdAt: string; image: string | null };
type StaffResponse = { users: Staff[] };

async function getStaff() {
  const response = await fetch("/api/staff", { cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 403 ? "Only a super administrator can manage staff roles and permissions." : "Staff access denied.");
  return response.json() as Promise<StaffResponse>;
}

export default function StaffManagement({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const staff = useQuery({ queryKey: ["staff"], queryFn: getStaff });
  const updateRole = useMutation({
    mutationFn: async (data: { userId: string; role: Role }) => {
      const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Role update denied.");
      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });
  const users = staff.data?.users ?? [];

  return <div className="min-h-screen bg-surface p-5 sm:p-8"><div className="mx-auto max-w-[1450px]">
    <div className="mb-6"><Link href="/" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary"><ArrowLeft size={15}/> Dashboard</Link><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold text-slate-900">Staff & permissions</h1><p className="mt-1 text-sm text-slate-500">Only super administrators can manage staff roles and permissions.</p></div><div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><ShieldCheck size={15}/> Permission checks active</div></div></div>
    {staff.isError && <p role="alert" className="mb-5 rounded-xl bg-danger-light p-4 text-sm text-[#8f3d2e]">{staff.error.message}</p>}
    {updateRole.isError && <p role="alert" className="mb-5 rounded-xl bg-danger-light p-4 text-sm text-[#8f3d2e]">{updateRole.error.message}</p>}
    <div className="mb-6 grid gap-4 sm:grid-cols-3"><Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">Active staff</p><Users size={18} className="text-primary"/></div><p className="mt-2 text-2xl font-bold text-slate-900">{users.filter((user) => !user.banned).length}</p></Card><Card className="p-5"><p className="text-sm text-slate-500">Roles in use</p><p className="mt-2 text-2xl font-bold text-slate-900">{new Set(users.map((user) => user.role)).size}</p></Card><Card className="p-5"><p className="text-sm text-slate-500">Access model</p><p className="mt-2 text-lg font-bold text-emerald-600">RBAC + permissions</p></Card></div>
    <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]"><Card className="overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Staff directory</h2><p className="mt-1 text-xs text-slate-500">Role changes are restricted to super administrators.</p></div><div className="divide-y divide-slate-100">{staff.isLoading ? <div className="p-10 text-center text-sm text-slate-500">Loading staff…</div> : users.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">No staff accounts yet. Create one from the registration page.</div> : users.map((user) => { const role = (user.role ?? "receptionist") as Role; return <div key={user.id} className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-primary">{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>{user.id === currentUserId ? <Badge tone="rose">{roleLabels[role] ?? role} · You</Badge> : <label className="relative"><span className="sr-only">Role for {user.name}</span><select value={role} disabled={updateRole.isPending} onChange={(event) => updateRole.mutate({ userId: user.id, role: event.target.value as Role })} className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60">{Object.keys(roleLabels).map((key) => <option key={key} value={key}>{roleLabels[key as Role]}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2 top-2.5 text-slate-400"/></label>}</div> })}</div></Card><Card className="overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Permission matrix</h2><p className="mt-1 text-xs text-slate-500">A quick reference for each role&apos;s allowed actions.</p></div><Suspense fallback={<div className="h-96 animate-pulse bg-slate-50"/>}><PermissionMatrix /></Suspense></Card></div>
  </div></div>;
}
