"use client";

import { Check, FileDown, FileUp, ShieldAlert, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { roleLabels, rolePermissions } from "@/auth/role-permissions";

const tones: Record<string, "blue" | "green" | "amber" | "rose" | "slate"> = { superadmin: "rose", manager: "blue", receptionist: "slate", doctor: "green", lab_technician: "amber", accountant: "blue", inventory_manager: "green" };

const actionLabels: Record<string, string> = {
  create: "Create", list: "View list", get: "View details", update: "Edit / update",
  delete: "Delete", "set-role": "Assign role", ban: "Suspend access",
  verify: "Verify", deliver: "Release", collect: "Collect payment", adjust: "Adjust stock",
};

const dataWorkflows = [
  { module: "Patients", import: "CSV / Excel: approved patient migration only; validate identifiers and duplicates", export: "CSV for authorized operational lists; PDF for individual records with audit logging" },
  { module: "Appointments", import: "Do not bulk-import routine appointments; use migration tooling for a one-time transfer", export: "CSV schedule for authorized users" },
  { module: "Doctors & diagnostic tests", import: "CSV / Excel: master data with stable codes, required fields and duplicate checks", export: "CSV / Excel catalog; PDF test catalogue when needed" },
  { module: "Lab orders & reports", import: "No spreadsheet/PDF import for live orders or results; enter and verify in workflow", export: "PDF for signed/released patient reports; CSV for operational summaries" },
  { module: "Billing", import: "Never import payments or invoices from spreadsheets; opening balances only via controlled migration", export: "PDF invoices/receipts; CSV for reconciliation and accounting" },
  { module: "Inventory & suppliers", import: "CSV / Excel item and supplier masters; opening stock requires lot, expiry, valuation and approval", export: "CSV / Excel stock, expiry and consumption; PDF for signed stock reports" },
  { module: "Staff & permissions", import: "No staff/role import; create accounts through BetterAuth and assign least-privilege roles", export: "Restricted CSV access list; never export passwords, tokens or secrets" },
  { module: "Analytics", import: "No import", export: "CSV for analysis; PDF for reviewed management reports" },
];

export function PermissionMatrix() {
  return <div className="max-h-[720px] overflow-auto">
    <div className="min-w-[650px] divide-y divide-slate-100">
      {Object.keys(roleLabels).map((role) => {
        const entries = Object.entries(rolePermissions[role as keyof typeof rolePermissions] as Record<string, readonly string[]>).flatMap(([resource, actions]) => actions.map((action) => ({ resource, action })));
        return <div key={role} className="grid grid-cols-[150px_1fr] gap-4 p-4"><div><Badge tone={tones[role] ?? "slate"}>{roleLabels[role as keyof typeof roleLabels]}</Badge></div><div className="flex flex-wrap gap-1.5">{entries.map(({ resource, action }) => <span key={`${resource}-${action}`} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${action === "delete" ? "bg-danger-light font-semibold text-[#a64e3a]" : "bg-slate-50 text-slate-700"}`}><Check size={11} className={action === "delete" ? "text-danger" : "text-emerald-600"}/>{resource}: {actionLabels[action] ?? action}</span>)}{entries.length === 0 && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><X size={12}/> No permissions</span>}</div></div>;
      })}
    </div>
    <section aria-labelledby="data-workflows-title" className="border-t border-slate-200 p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-2"><ShieldAlert size={17} className="mt-0.5 shrink-0 text-primary"/><div><h3 id="data-workflows-title" className="text-sm font-bold text-heading">Recommended import & export policy</h3><p className="mt-1 text-xs text-body">Import/export availability must also be enforced by a permission-checked API; PDF is an output format, not a safe structured-data import format.</p></div></div>
      <div className="space-y-2">
        {dataWorkflows.map((workflow) => <div key={workflow.module} className="rounded-xl border border-border bg-white p-3">
          <h4 className="mb-2 text-xs font-bold text-heading">{workflow.module}</h4>
          <p className="flex items-start gap-2 text-xs leading-5 text-body"><FileUp size={14} className="mt-0.5 shrink-0 text-primary"/><span><strong className="text-heading">Import:</strong> {workflow.import}</span></p>
          <p className="mt-1 flex items-start gap-2 text-xs leading-5 text-body"><FileDown size={14} className="mt-0.5 shrink-0 text-primary"/><span><strong className="text-heading">Export:</strong> {workflow.export}</span></p>
        </div>)}
      </div>
    </section>
  </div>;
}
