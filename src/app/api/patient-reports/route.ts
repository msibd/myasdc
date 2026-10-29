import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" };

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = `880${digits.slice(1)}`;
  return digits;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your mobile number and report reference." }, { status: 400, headers: noStore });
  }

  const payload = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const phone = typeof payload.phone === "string" ? normalizePhone(payload.phone) : "";
  const reportId = typeof payload.reportId === "string" ? payload.reportId.trim() : "";
  if (phone.length < 8 || phone.length > 15 || reportId.length < 8 || reportId.length > 64) {
    return NextResponse.json({ error: "Enter a valid mobile number and report reference." }, { status: 422, headers: noStore });
  }

  try {
    const report = await prisma.testReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        status: true,
        verifiedAt: true,
        approvedAt: true,
        deliveredAt: true,
        resultText: true,
        verifiedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        labOrder: {
          select: {
            createdAt: true,
            patient: { select: { name: true, phone: true, isActive: true } },
            diagnosticTest: { select: { name: true, department: true } },
          },
        },
      },
    });

    const storedPhone = report?.labOrder.patient.phone ? normalizePhone(report.labOrder.patient.phone) : "";
    if (!report || !report.labOrder.patient.isActive || !["approved", "delivered"].includes(report.status) || !report.resultText || storedPhone !== phone) {
      return NextResponse.json({ error: "No released report matched those details. Check them or contact the centre." }, { status: 404, headers: noStore });
    }

    return NextResponse.json({
      report: {
        reference: report.id,
        status: report.status,
        verifiedAt: report.verifiedAt,
        approvedAt: report.approvedAt,
        deliveredAt: report.deliveredAt,
        patientName: report.labOrder.patient.name,
        orderedAt: report.labOrder.createdAt,
        testName: report.labOrder.diagnosticTest.name,
        department: report.labOrder.diagnosticTest.department,
        resultText: report.resultText,
        verifiedBy: report.verifiedBy?.name ?? null,
        approvedBy: report.approvedBy?.name ?? null,
      },
    }, { headers: noStore });
  } catch (error) {
    console.error("Public patient report lookup failed", error);
    return NextResponse.json({ error: "Reports are temporarily unavailable. Please try again later." }, { status: 503, headers: noStore });
  }
}
