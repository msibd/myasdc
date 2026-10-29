import { cn } from "@/lib/utils";
export function Card({ className, children, style }: { className?: string; children: React.ReactNode; style?: React.CSSProperties }) { return <div style={style} className={cn("rounded-2xl border border-border bg-card shadow-sm", className)}>{children}</div>; }
export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "amber" | "blue" | "rose" }) {
  const tones = { slate: "bg-slate-100 text-body", green: "bg-success-light text-[#087d69]", amber: "bg-warning-light text-[#956000]", blue: "bg-primary-light text-primary-dark", rose: "bg-danger-light text-[#a64e3a]" };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}
