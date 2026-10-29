"use client";

import { cn } from "@/lib/utils";
import { Tooltip as RechartsTooltip, Legend as RechartsLegend } from "recharts";

export function ChartContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("h-[280px] w-full", className)}>{children}</div>;
}

export function ChartTooltip(props: Record<string, unknown>) { return <RechartsTooltip {...props} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />; }
export function ChartLegend() { return <RechartsLegend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 12 }} />; }

export function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string | number; name?: string | number; value?: string | number }>; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg"><p className="mb-1 font-semibold text-heading">{label}</p>{payload.map((item) => <div key={String(item.dataKey)} className="flex items-center justify-between gap-4 text-muted"><span>{String(item.name ?? item.dataKey)}</span><strong className="text-heading">{typeof item.value === "number" ? item.value.toLocaleString() : item.value}</strong></div>)}</div>;
}
