import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const permission = await requireSession(request);
  if (permission.response) return permission.response;
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const period = new URL(request.url).searchParams.get("period") ?? "today";
    const rangeStart = period === "month" ? new Date(now.getFullYear(), now.getMonth(), 1) : period === "week" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)) : today;
    const rangeEnd = new Date(now);
    rangeEnd.setHours(23, 59, 59, 999);
    const [totalPatients, todayPatients, appointmentsInRange, testsInRange, activeTestCount, pendingReports, pendingReportSamples, billingDueCount, lowStockCountRows, lowStockItems, recentPatients, collectedInRange, ready, processing, verifiedReports, weeklyTests] = await Promise.all([
      prisma.patient.count({ where: { isActive: true } }),
      prisma.patient.count({ where: { isActive: true, createdAt: { gte: today, lte: rangeEnd } } }),
      prisma.appointment.count({ where: { date: { gte: rangeStart, lte: rangeEnd } } }),
      prisma.labOrder.count({ where: { createdAt: { gte: rangeStart, lte: rangeEnd } } }),
      prisma.diagnosticTest.count({ where: { isActive: true } }),
      prisma.testReport.count({ where: { status: "draft", resultText: { not: null } } }),
      prisma.testReport.findMany({
        where: { status: "draft", resultText: { not: null } },
        orderBy: { labOrder: { createdAt: "desc" } },
        take: 3,
        select: { id: true, labOrder: { select: { patient: { select: { name: true } }, diagnosticTest: { select: { name: true } } } } },
      }),
      prisma.invoice.count({ where: { status: { in: ["unpaid", "partial"] } } }),
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS "count"
        FROM "InventoryItem"
        WHERE "isActive" = true AND "quantity" <= "reorderLevel"
      `,
      prisma.$queryRaw<{ id: string; name: string; quantity: number; reorderLevel: number; unit: string }[]>`
        SELECT "id", "name", "quantity"::float8 AS "quantity", "reorderLevel"::float8 AS "reorderLevel", "unit"
        FROM "InventoryItem"
        WHERE "isActive" = true AND "quantity" <= "reorderLevel"
        ORDER BY ("reorderLevel" - "quantity") DESC, "name" ASC
        LIMIT 3
      `,
      prisma.patient.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, age: true, gender: true, createdAt: true } }),
      prisma.invoicePayment.aggregate({ where: { paidAt: { gte: rangeStart, lte: rangeEnd } }, _sum: { amount: true } }),
      prisma.labOrder.count({ where: { status: "ready" } }),
      prisma.labOrder.count({ where: { status: "processing" } }),
      prisma.testReport.count({ where: { status: "verified" } }),
      prisma.$queryRaw<{ day: Date; count: number }[]>`
        SELECT date_trunc('day', "createdAt")::date AS day, COUNT(*)::int AS count
        FROM "LabOrder"
        WHERE "createdAt" >= ${weekStart} AND "createdAt" <= ${rangeEnd}
        GROUP BY day ORDER BY day
      `,
    ]);

    return NextResponse.json({
      period,
      rangeStart: rangeStart.toISOString(),
      totalPatients,
      todayPatients,
      todayAppointments: appointmentsInRange,
      testsToday: testsInRange,
      revenue: Number(collectedInRange._sum.amount ?? 0),
      activeTestCount,
      pendingReports,
      pendingReportSamples,
      billingDueCount,
      lowStockCount: lowStockCountRows[0]?.count ?? 0,
      lowStockItems,
      ready,
      processing,
      verifiedReports,
      weeklyTests: weeklyTests.map((row) => ({ day: row.day.toISOString(), count: row.count })),
      recentPatients,
    });
  } catch (error) {
    console.error("Dashboard data error", error);
    return NextResponse.json({ error: "Database is unavailable. Check DATABASE_URL and run Prisma migrations." }, { status: 503 });
  }
}
