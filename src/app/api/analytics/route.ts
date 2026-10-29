import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";

export const dynamic = "force-dynamic";

function dateOnly(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function isoDay(value: Date) { return value.toISOString().slice(0, 10); }

export async function GET(request: Request) {
  const permission = await requirePermission(request, "analytics", ["get"]);
  if (permission.response) return permission.response;
  const url = new URL(request.url);
  const requestedPeriod = Number(url.searchParams.get("period") ?? 30);
  const period = [7, 30, 90].includes(requestedPeriod) ? requestedPeriod : 30;
  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - period + 1);
  const start = dateOnly(url.searchParams.get("start"), defaultStart);
  const endDate = dateOnly(url.searchParams.get("end"), new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const endExclusive = new Date(endDate);
  endExclusive.setDate(endExclusive.getDate() + 1);

  try {
    const [ordersByDay, revenueByDay, revenueByMonth, categoryDistribution, popularTests, orderStatuses, totalPatients, pendingReports, activeTestCount] = await Promise.all([
      prisma.$queryRaw<Array<{ bucket: Date; total: bigint }>>(Prisma.sql`SELECT DATE_TRUNC('day', "createdAt") AS bucket, COUNT(*)::bigint AS total FROM "LabOrder" WHERE "createdAt" >= ${start} AND "createdAt" < ${endExclusive} GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw<Array<{ bucket: Date; total: Prisma.Decimal }>>(Prisma.sql`SELECT DATE_TRUNC('day', "paidAt") AS bucket, COALESCE(SUM(amount), 0) AS total FROM "InvoicePayment" WHERE "paidAt" >= ${start} AND "paidAt" < ${endExclusive} GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw<Array<{ bucket: Date; total: Prisma.Decimal }>>(Prisma.sql`SELECT DATE_TRUNC('month', "paidAt") AS bucket, COALESCE(SUM(amount), 0) AS total FROM "InvoicePayment" WHERE "paidAt" >= ${start} AND "paidAt" < ${endExclusive} GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw<Array<{ category: string; total: bigint }>>(Prisma.sql`SELECT "DiagnosticTest"."department" AS category, COUNT("LabOrder"."id")::bigint AS total FROM "LabOrder" INNER JOIN "DiagnosticTest" ON "DiagnosticTest"."id" = "LabOrder"."diagnosticTestId" WHERE "LabOrder"."createdAt" >= ${start} AND "LabOrder"."createdAt" < ${endExclusive} AND "LabOrder"."status" <> 'cancelled' GROUP BY 1 ORDER BY 2 DESC`),
      prisma.$queryRaw<Array<{ id: string; name: string; department: string; total: bigint }>>(Prisma.sql`SELECT "DiagnosticTest"."id", "DiagnosticTest"."name", "DiagnosticTest"."department", COUNT("LabOrder"."id")::bigint AS total FROM "LabOrder" INNER JOIN "DiagnosticTest" ON "DiagnosticTest"."id" = "LabOrder"."diagnosticTestId" WHERE "LabOrder"."createdAt" >= ${start} AND "LabOrder"."createdAt" < ${endExclusive} AND "LabOrder"."status" <> 'cancelled' GROUP BY 1, 2, 3 ORDER BY 4 DESC, 2 ASC LIMIT 10`),
      prisma.labOrder.groupBy({ by: ["status"], where: { createdAt: { gte: start, lt: endExclusive } }, _count: { _all: true } }),
      prisma.patient.count({ where: { isActive: true, createdAt: { gte: start, lt: endExclusive } } }),
      prisma.testReport.count({ where: { status: "draft" } }),
      prisma.diagnosticTest.count({ where: { isActive: true } }),
    ]);

    const orders = new Map(ordersByDay.map((row) => [isoDay(row.bucket), Number(row.total)]));
    const revenue = new Map(revenueByDay.map((row) => [isoDay(row.bucket), Number(row.total)]));
    const timeline = Array.from({ length: Math.max(1, Math.ceil((endExclusive.getTime() - start.getTime()) / 86400000)) }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return { date: isoDay(date), label: index === 0 || date.getDate() === 1 ? date.toLocaleDateString("en-US", { day: "2-digit", month: "short" }) : String(date.getDate()).padStart(2, "0"), orders: orders.get(isoDay(date)) ?? 0, revenue: revenue.get(isoDay(date)) ?? 0 }; });
    return NextResponse.json({ filters: { period, startDate: isoDay(start), endDate: isoDay(endDate) }, metrics: { totalPatients, dailyRevenue: timeline.reduce((sum, item) => sum + item.revenue, 0), testOrders: timeline.reduce((sum, item) => sum + item.orders, 0), pendingReports, activeTestCount }, dailyTestOrders: timeline, monthlyRevenue: revenueByMonth.map((row) => ({ month: row.bucket.toISOString().slice(0, 7), label: row.bucket.toLocaleDateString("en-US", { month: "short", year: "numeric" }), revenue: Number(row.total) })), testCategories: categoryDistribution.map((row) => ({ category: row.category, orders: Number(row.total) })), popularTests: popularTests.map((row) => ({ id: row.id, name: row.name, department: row.department, orders: Number(row.total) })), orderStatuses: orderStatuses.map((row) => ({ status: row.status, orders: row._count._all })) });
  } catch (error) {
    console.error("Analytics query error", error);
    return NextResponse.json({ error: "Unable to load analytics data." }, { status: 500 });
  }
}
