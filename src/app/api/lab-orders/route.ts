import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const METHODS = new Set(["cash", "card", "bank_transfer", "mobile_banking"]);
const isSerializationConflict = (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "P2034");

export async function GET(request: Request) {
  const permission = await requirePermission(request, "lab", ["list"]);
  if (permission.response) return permission.response;
  try {
    const orders = await prisma.labOrder.findMany({
      orderBy: { createdAt: "desc" }, take: 100,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        doctor: { select: { id: true, name: true } },
        technician: { select: { id: true, name: true } },
        diagnosticTest: { select: { id: true, name: true, department: true, price: true } },
        report: { select: { id: true, status: true, resultText: true, resultEnteredAt: true, verifiedAt: true, approvedAt: true, deliveredAt: true } },
        invoice: { select: { id: true, subtotal: true, discount: true, total: true, paid: true, status: true } },
      },
    });
    return NextResponse.json(orders, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Lab order list failed", error);
    return NextResponse.json({ error: "Database is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const permission = await requirePermission(request, "lab", ["create"]);
  if (permission.response || !permission.session) return permission.response;
  let body: Record<string, unknown>;
  try {
    const payload: unknown = await request.json();
    body = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const patientId = typeof body.patientId === "string" ? body.patientId : "";
  const diagnosticTestId = typeof body.diagnosticTestId === "string" ? body.diagnosticTestId : "";
  const doctorId = typeof body.doctorId === "string" && body.doctorId ? body.doctorId : null;
  const specimenType = typeof body.specimenType === "string" ? body.specimenType.trim() : "";
  const discount = Number(body.discount ?? 0);
  const paid = Number(body.paid ?? 0);
  const paymentMethod = String(body.paymentMethod ?? "cash");
  if (!patientId || !diagnosticTestId || specimenType.length > 100 || !Number.isFinite(discount) || discount < 0 || !Number.isFinite(paid) || paid < 0 || !METHODS.has(paymentMethod)) {
    return NextResponse.json({ error: "Patient, test, specimen type, discount, paid amount and payment method must be valid." }, { status: 422 });
  }

  try {
    const [patient, test, doctor] = await Promise.all([
      prisma.patient.findFirst({ where: { id: patientId, isActive: true }, select: { id: true } }),
      prisma.diagnosticTest.findFirst({ where: { id: diagnosticTestId, isActive: true }, select: { id: true, name: true, department: true, price: true } }),
      doctorId ? prisma.doctor.findFirst({ where: { id: doctorId, isActive: true }, select: { id: true } }) : Promise.resolve(null),
    ]);
    if (!patient || !test || (doctorId && !doctor)) return NextResponse.json({ error: "Choose an active patient, diagnostic test and doctor." }, { status: 422 });
    const subtotal = Number(test.price);
    const total = Math.round((subtotal - discount) * 100) / 100;
    if (discount >= subtotal || paid > total) return NextResponse.json({ error: "Discount must be less than the test price and paid amount cannot exceed the invoice total." }, { status: 422 });

    const barcode = `SMP-${randomBytes(6).toString("hex").toUpperCase()}`;
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.labOrder.create({
        data: { patientId, diagnosticTestId, doctorId, status: "awaiting_sample", sampleBarcode: barcode, specimenType: specimenType || null, testPrice: subtotal },
        include: { patient: true, doctor: true, diagnosticTest: true },
      });
      const invoice = await tx.invoice.create({
        data: {
          patientId, labOrderId: created.id, subtotal, discount, total, paid, paymentMethod,
          status: paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid",
          ...(paid > 0 ? { payments: { create: { amount: paid, paymentMethod } } } : {}),
        },
      });
      const report = await tx.testReport.create({ data: { labOrderId: created.id, status: "draft" } });
      await tx.workflowEvent.createMany({ data: [
        { labOrderId: created.id, actorId: permission.session.user.id, action: "test_order_created", toStatus: "awaiting_sample", note: `Test ordered: ${test.name}` },
        { labOrderId: created.id, actorId: permission.session.user.id, action: "invoice_issued", note: `Invoice ${invoice.id} · total ${total.toFixed(2)} · paid ${paid.toFixed(2)}` },
        { labOrderId: created.id, actorId: permission.session.user.id, action: "report_record_created", toStatus: "draft" },
      ] });

      // Preserve the existing FEFO inventory consumption workflow.
      const mappings = await tx.testInventoryMapping.findMany({ where: { diagnosticTestId }, include: { inventoryItem: true } });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (const mapping of mappings) {
        let remaining = Number(mapping.quantityPerTest);
        if (Number(mapping.inventoryItem.quantity) < remaining) throw new Error(`INSUFFICIENT_MAPPED_STOCK:${mapping.inventoryItem.name}`);
        const batches = await tx.inventoryBatch.findMany({ where: { itemId: mapping.inventoryItemId, quantityOnHand: { gt: 0 }, expiresAt: { gt: today } }, orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }] });
        for (const batch of batches) {
          if (remaining <= 0) break;
          const taken = Math.min(Number(batch.quantityOnHand), remaining);
          const changed = await tx.inventoryBatch.updateMany({ where: { id: batch.id, quantityOnHand: { gte: taken } }, data: { quantityOnHand: { decrement: taken } } });
          if (changed.count !== 1) throw new Error("INVENTORY_CONFLICT");
          await tx.inventoryMovement.create({ data: { itemId: mapping.inventoryItemId, batchId: batch.id, kind: "test_consumption", quantity: -taken, reason: `Auto-consumed for ${test.name}`, department: test.department, testId: diagnosticTestId, labOrderId: created.id } });
          remaining -= taken;
        }
        if (remaining > 0) throw new Error(`INSUFFICIENT_MAPPED_STOCK:${mapping.inventoryItem.name}`);
        const changedItem = await tx.inventoryItem.updateMany({ where: { id: mapping.inventoryItemId, quantity: { gte: Number(mapping.quantityPerTest) } }, data: { quantity: { decrement: Number(mapping.quantityPerTest) } } });
        if (changedItem.count !== 1) throw new Error("INVENTORY_CONFLICT");
      }
      return { ...created, invoice, report };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_MAPPED_STOCK:")) return NextResponse.json({ error: `Insufficient mapped inventory: ${error.message.split(":")[1]}` }, { status: 409 });
    if ((error instanceof Error && error.message === "INVENTORY_CONFLICT") || isSerializationConflict(error)) return NextResponse.json({ error: "Inventory changed concurrently. Refresh and retry." }, { status: 409 });
    console.error("Lab order creation failed", error);
    return NextResponse.json({ error: "Unable to create test order and invoice." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    const payload: unknown = await request.json();
    body = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const action = body.action === "collect" ? "collect" : body.action === "assign" ? "assign" : "";
  if (!action) return NextResponse.json({ error: "Choose a supported lab workflow action." }, { status: 422 });
  const access = await requirePermission(request, "lab", [action]);
  if (access.response || !access.session) return access.response;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Lab order ID is required." }, { status: 422 });

  try {
    if (action === "collect") {
      const barcode = typeof body.barcode === "string" ? body.barcode.trim().toUpperCase() : "";
      const specimenType = typeof body.specimenType === "string" ? body.specimenType.trim() : "";
      if (!barcode || !specimenType || specimenType.length > 100) return NextResponse.json({ error: "Scan the sample barcode and enter specimen type." }, { status: 422 });
      const order = await prisma.$transaction(async (tx) => {
        const current = await tx.labOrder.findUnique({ where: { id } });
        if (!current || current.sampleBarcode !== barcode) throw new Error("BARCODE_MISMATCH");
        if (current.status !== "awaiting_sample") throw new Error("SAMPLE_ALREADY_PROCESSED");
        const changed = await tx.labOrder.update({ where: { id }, data: { specimenType, sampleStatus: "collected", sampleCollectedAt: new Date(), sampleCollectedById: access.session!.user.id, status: "processing" } });
        await tx.workflowEvent.create({ data: { labOrderId: id, actorId: access.session!.user.id, action: "sample_collected", fromStatus: current.status, toStatus: "processing", note: `${specimenType} · ${barcode}` } });
        return changed;
      });
      return NextResponse.json(order);
    }

    const technicianId = typeof body.technicianId === "string" ? body.technicianId : "";
    const technician = await prisma.user.findFirst({ where: { id: technicianId, role: "lab_technician", banned: false }, select: { id: true } });
    if (!technician) return NextResponse.json({ error: "Select an active lab technician account." }, { status: 422 });
    const current = await prisma.labOrder.findUnique({ where: { id }, select: { technicianId: true } });
    if (!current) return NextResponse.json({ error: "Lab order not found." }, { status: 404 });
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.labOrder.update({ where: { id }, data: { technicianId, technicianAssignedAt: new Date() } });
      await tx.workflowEvent.create({ data: { labOrderId: id, actorId: access.session!.user.id, action: "technician_assigned", note: `Assigned technician ${technicianId}` } });
      return updated;
    });
    return NextResponse.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "BARCODE_MISMATCH") return NextResponse.json({ error: "The scanned barcode does not match this order." }, { status: 409 });
    if (message === "SAMPLE_ALREADY_PROCESSED") return NextResponse.json({ error: "This sample has already been collected or processed." }, { status: 409 });
    console.error("Lab workflow update failed", error);
    return NextResponse.json({ error: "Unable to update lab workflow." }, { status: 500 });
  }
}
