import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";

export const dynamic = "force-dynamic";
const PAYMENT_METHODS = new Set(["cash", "card", "bank_transfer", "mobile_banking"]);

export async function GET(request: Request) {
  const permission = await requirePermission(request, "billing", ["list"]);
  if (permission.response) return permission.response;
  try {
    return NextResponse.json(await prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { patient: { select: { name: true, phone: true } }, labOrder: { select: { id: true, diagnosticTest: { select: { name: true, department: true } } } }, payments: { orderBy: { paidAt: "desc" } } } }));
  } catch {
    return NextResponse.json({ error: "Database is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const permission = await requirePermission(request, "billing", body.action === "payment" ? ["collect"] : ["create"]);
    if (permission.response) return permission.response;
    if (body.action === "issue_and_collect") {
      const collectPermission = await requirePermission(request, "billing", ["collect"]);
      if (collectPermission.response) return collectPermission.response;
      const subtotal = Number(body.subtotal);
      const discount = Number(body.discount ?? 0);
      const paymentMethod = String(body.paymentMethod ?? "cash");
      const total = Math.round((subtotal - discount) * 100) / 100;
      if (typeof body.patientId !== "string" || !body.patientId || !Number.isFinite(subtotal) || subtotal <= 0 || !Number.isFinite(discount) || discount < 0 || discount > subtotal || total <= 0 || !PAYMENT_METHODS.has(paymentMethod)) {
        return NextResponse.json({ error: "Choose a patient and enter valid subtotal, discount, and payment method." }, { status: 422 });
      }
      const invoice = await prisma.$transaction(async (tx) => {
        const created = await tx.invoice.create({
          data: {
            patientId: body.patientId,
            subtotal,
            discount,
            total,
            paid: total,
            paymentMethod,
            status: "paid",
            payments: { create: { amount: total, paymentMethod } },
          },
          include: { patient: true, payments: true },
        });
        return created;
      });
      return NextResponse.json(invoice, { status: 201 });
    }
    if (body.action === "payment") {
      const amount = Number(body.amount);
      if (!body.invoiceId || !amount || amount <= 0) return NextResponse.json({ error: "Invoice and a valid amount are required." }, { status: 422 });
      const paymentMethod = PAYMENT_METHODS.has(String(body.paymentMethod)) ? String(body.paymentMethod) : "cash";
      const invoice = await prisma.$transaction(async (tx) => {
        const current = await tx.invoice.findUniqueOrThrow({ where: { id: body.invoiceId } });
        const paid = Number(current.paid) + amount;
        const status = paid >= Number(current.total) ? "paid" : "partial";
        await tx.invoicePayment.create({ data: { invoiceId: current.id, amount, paymentMethod } });
        return tx.invoice.update({ where: { id: current.id }, data: { paid, status, paymentMethod }, include: { patient: true, payments: true } });
      });
      return NextResponse.json(invoice);
    }
    if (!body.patientId || !body.total || Number(body.total) <= 0) return NextResponse.json({ error: "Patient and a valid total are required." }, { status: 422 });
    const total = Number(body.total);
    const paid = Number(body.paid || 0);
    const paymentMethod = PAYMENT_METHODS.has(String(body.paymentMethod)) ? String(body.paymentMethod) : "cash";
    const invoice = await prisma.invoice.create({ data: { patientId: body.patientId, subtotal: total, total, paid, paymentMethod, status: paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid", ...(Number(body.discount) > 0 ? { discount: Number(body.discount) } : {}) }, include: { patient: true, payments: true } });
    if (paid > 0) await prisma.invoicePayment.create({ data: { invoiceId: invoice.id, amount: paid, paymentMethod } });
    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Billing action error", error);
    return NextResponse.json({ error: "Unable to update billing." }, { status: 500 });
  }
}
