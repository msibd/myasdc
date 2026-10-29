import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const permission = await requirePermission(request, "patient", ["get"]);
  if (permission.response) return permission.response;
  const { id } = await context.params;
  try {
    const patient = await prisma.patient.findFirst({
      where: { id, isActive: true },
      include: {
        _count: { select: { appointments: true, labOrders: true, invoices: true } },
        labOrders: { take: 5, orderBy: { createdAt: "desc" }, include: { diagnosticTest: { select: { name: true, department: true } }, report: { select: { status: true } } } },
      },
    });
    if (!patient) return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    return NextResponse.json(patient);
  } catch (error) {
    console.error("Patient detail error", error);
    return NextResponse.json({ error: "Unable to load patient details." }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const permission = await requirePermission(request, "patient", ["update"]);
  if (permission.response) return permission.response;
  const { id } = await context.params;
  try {
    const body = await request.json() as Record<string, unknown>;
    const validation = validatePatient(body);
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 422 });
    const updated = await prisma.patient.updateMany({ where: { id, isActive: true }, data: validation.data! });
    if (updated.count === 0) return NextResponse.json({ error: "Patient not found or already archived." }, { status: 404 });
    return NextResponse.json(await prisma.patient.findUniqueOrThrow({ where: { id } }));
  } catch (error) {
    console.error("Patient update error", error);
    return NextResponse.json({ error: "Unable to update patient." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const permission = await requirePermission(request, "patient", ["delete"]);
  if (permission.response) return permission.response;
  const { id } = await context.params;
  try {
    const result = await prisma.patient.updateMany({
      where: { id, isActive: true },
      data: { isActive: false, archivedAt: new Date() },
    });
    if (result.count === 0) return NextResponse.json({ error: "Patient not found or already archived." }, { status: 404 });
    return NextResponse.json({ success: true, archived: true });
  } catch (error) {
    console.error("Patient archive error", error);
    return NextResponse.json({ error: "Unable to archive patient." }, { status: 500 });
  }
}

function validatePatient(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 160) return { error: "Patient name is required and must be under 160 characters." };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  const age = body.age === "" || body.age === null || body.age === undefined ? null : Number(body.age);
  if (age !== null && (!Number.isInteger(age) || age < 0 || age > 130)) return { error: "Age must be a whole number between 0 and 130." };
  const gender = typeof body.gender === "string" && body.gender ? body.gender : null;
  if (gender && !["Female", "Male", "Other"].includes(gender)) return { error: "Select a valid gender." };
  const bloodGroup = typeof body.bloodGroup === "string" && body.bloodGroup ? body.bloodGroup : null;
  if (bloodGroup && !["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].includes(bloodGroup)) return { error: "Select a valid blood group." };
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (phone.length > 32) return { error: "Phone number is too long." };
  return { data: { name, phone: phone || null, email: email || null, age, gender, bloodGroup } };
}
