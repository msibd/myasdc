import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";
import { validateDoctor } from "../route";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const permission = await requirePermission(request, "doctor", ["get"]);
  if (permission.response) return permission.response;
  const { id } = await params;
  try {
    const doctor = await prisma.doctor.findUnique({ where: { id }, include: { _count: { select: { appointments: true } }, appointments: { orderBy: { date: "desc" }, take: 10, include: { patient: { select: { id: true, name: true } } } } } });
    if (!doctor) return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
    return NextResponse.json(doctor);
  } catch {
    return NextResponse.json({ error: "Unable to load doctor details." }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const permission = await requirePermission(request, "doctor", ["update"]);
  if (permission.response) return permission.response;
  const { id } = await params;
  try {
    const validation = validateDoctor(await request.json());
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 422 });
    const doctor = await prisma.doctor.update({ where: { id }, data: validation.data! });
    return NextResponse.json(doctor);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "That registration number is already assigned." }, { status: 409 });
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
    return NextResponse.json({ error: "Unable to update doctor." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const permission = await requirePermission(request, "doctor", ["delete"]);
  if (permission.response) return permission.response;
  const { id } = await params;
  try {
    const doctor = await prisma.doctor.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ id: doctor.id, isActive: doctor.isActive });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
    return NextResponse.json({ error: "Unable to deactivate doctor." }, { status: 500 });
  }
}
