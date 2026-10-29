import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { PageSkeleton } from "@/components/loading";
import { AnalyticsDashboard } from "./analytics-dashboard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const canView = await auth.api.userHasPermission({ body: { userId: session.user.id, permissions: { analytics: ["get"] } } });
  if (!canView.success) redirect("/");
  return <div className="min-h-screen bg-surface p-5 sm:p-8"><div className="mx-auto max-w-[1500px]"><Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary">← Dashboard</Link><Suspense fallback={<PageSkeleton />}><AnalyticsDashboard /></Suspense></div></div>;
}
