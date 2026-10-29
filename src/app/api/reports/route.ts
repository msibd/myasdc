import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";
import { rolePermissions } from "@/auth/role-permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requirePermission(request, "report", ["list"]);
  if (access.response) return access.response;
  try {
    const limit = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 100));
    const reports = await prisma.testReport.findMany({
      orderBy: { labOrder: { createdAt: "desc" } }, take: limit,
      include: {
        enteredBy: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        labOrder: {
          include: {
            patient: { select: { id: true, name: true, phone: true } },
            doctor: { select: { id: true, name: true } },
            technician: { select: { id: true, name: true } },
            diagnosticTest: { select: { name: true, department: true } },
            invoice: { select: { id: true, total: true, paid: true, status: true } },
            workflowEvents: { orderBy: { createdAt: "asc" }, take: 25, include: { actor: { select: { name: true } } } },
          },
        },
      },
    });
    const role = (access.session?.user.role ?? "receptionist") as keyof typeof rolePermissions;
    const actions = (rolePermissions as Record<string, { report?: readonly string[] }>)[role]?.report ?? [];
    return NextResponse.json({ reports, permissions: { canEdit: actions.includes("update"), canVerify: actions.includes("verify"), canApprove: actions.includes("approve"), canDeliver: actions.includes("deliver") } }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Report list failed", error);
    return NextResponse.json({ error: "Database is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const payload: unknown = await request.json();
    body = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "create";
  const requiredAction = action === "verify" ? "verify" : action === "approve" ? "approve" : action === "deliver" ? "deliver" : action === "result" ? "update" : "create";
  const access = await requirePermission(request, "report", [requiredAction]);
  if (access.response || !access.session) return access.response;
  const actorId = access.session.user.id;
  const reportId = typeof body.id === "string" ? body.id : "";

  if (action === "create") {
    if (typeof body.labOrderId !== "string" || !body.labOrderId) return NextResponse.json({ error: "Lab order is required." }, { status: 422 });
    try {
      const report = await prisma.testReport.upsert({ where: { labOrderId: body.labOrderId }, create: { labOrderId: body.labOrderId, status: "draft" }, update: {} });
      return NextResponse.json(report, { status: 201 });
    } catch (error) {
      console.error("Report record creation failed", error);
      return NextResponse.json({ error: "Unable to create report record." }, { status: 500 });
    }
  }

  if (!reportId) return NextResponse.json({ error: "Report ID is required." }, { status: 422 });
  try {
    const current = await prisma.testReport.findUnique({ where: { id: reportId }, include: { labOrder: { select: { id: true, status: true, technicianId: true, sampleStatus: true } } } });
    if (!current) return NextResponse.json({ error: "Report not found." }, { status: 404 });

    if (action === "result") {
      const resultText = typeof body.resultText === "string" ? body.resultText.trim() : "";
      if (!resultText || resultText.length > 12000) return NextResponse.json({ error: "Enter a result between 1 and 12000 characters." }, { status: 422 });
      if (current.status !== "draft") return NextResponse.json({ error: "Results cannot be changed after verification." }, { status: 409 });
      if (current.labOrder.sampleStatus !== "collected" || current.labOrder.status === "awaiting_sample") return NextResponse.json({ error: "Collect and barcode-check the sample before entering results." }, { status: 409 });
      if (access.session.user.role === "lab_technician" && current.labOrder.technicianId !== actorId) return NextResponse.json({ error: "Only the assigned technician can enter this result." }, { status: 403 });
      const updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.testReport.updateMany({ where: { id: reportId, status: "draft" }, data: { resultText, resultEnteredAt: new Date(), enteredById: actorId } });
        if (claimed.count !== 1) throw new Error("REPORT_STATE_CHANGED");
        await tx.labOrder.update({ where: { id: current.labOrder.id }, data: { status: "under_review" } });
        await tx.workflowEvent.create({ data: { labOrderId: current.labOrder.id, actorId, action: "result_entered", fromStatus: current.labOrder.status, toStatus: "under_review" } });
        return tx.testReport.findUniqueOrThrow({ where: { id: reportId } });
      });
      return NextResponse.json(updated);
    }

    if (action === "verify") {
      if (current.status !== "draft" || !current.resultText?.trim()) return NextResponse.json({ error: "Enter the result before verification." }, { status: 409 });
      if (current.enteredById === actorId) return NextResponse.json({ error: "A different authorized reviewer must verify this result." }, { status: 403 });
      const now = new Date();
      const updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.testReport.updateMany({ where: { id: reportId, status: "draft", resultText: { not: null } }, data: { status: "verified", verifiedAt: now, verifiedById: actorId } });
        if (claimed.count !== 1) throw new Error("REPORT_STATE_CHANGED");
        await tx.labOrder.update({ where: { id: current.labOrder.id }, data: { status: "verified" } });
        await tx.workflowEvent.create({ data: { labOrderId: current.labOrder.id, actorId, action: "result_verified", fromStatus: "under_review", toStatus: "verified" } });
        return tx.testReport.findUniqueOrThrow({ where: { id: reportId } });
      });
      return NextResponse.json(updated);
    }

    if (action === "approve") {
      if (current.status !== "verified") return NextResponse.json({ error: "Only a verified report can be approved." }, { status: 409 });
      if (current.verifiedById === actorId) return NextResponse.json({ error: "A different authorized approver must approve this report." }, { status: 403 });
      const now = new Date();
      const updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.testReport.updateMany({ where: { id: reportId, status: "verified" }, data: { status: "approved", approvedAt: now, approvedById: actorId } });
        if (claimed.count !== 1) throw new Error("REPORT_STATE_CHANGED");
        await tx.labOrder.update({ where: { id: current.labOrder.id }, data: { status: "ready" } });
        await tx.workflowEvent.create({ data: { labOrderId: current.labOrder.id, actorId, action: "report_approved", fromStatus: "verified", toStatus: "approved" } });
        return tx.testReport.findUniqueOrThrow({ where: { id: reportId } });
      });
      return NextResponse.json(updated);
    }

    if (action === "deliver") {
      if (current.status !== "approved") return NextResponse.json({ error: "Only an approved report can be delivered." }, { status: 409 });
      const now = new Date();
      const updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.testReport.updateMany({ where: { id: reportId, status: "approved" }, data: { status: "delivered", deliveredAt: now } });
        if (claimed.count !== 1) throw new Error("REPORT_STATE_CHANGED");
        await tx.labOrder.update({ where: { id: current.labOrder.id }, data: { status: "delivered" } });
        await tx.workflowEvent.create({ data: { labOrderId: current.labOrder.id, actorId, action: "report_delivered", fromStatus: "approved", toStatus: "delivered" } });
        return tx.testReport.findUniqueOrThrow({ where: { id: reportId } });
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Unsupported report action." }, { status: 422 });
  } catch (error) {
    if (error instanceof Error && error.message === "REPORT_STATE_CHANGED") return NextResponse.json({ error: "Report status changed in another session. Refresh and try again." }, { status: 409 });
    console.error("Report workflow update failed", error);
    return NextResponse.json({ error: "Unable to update report workflow." }, { status: 500 });
  }
}
