import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const permission = await requirePermission(request, "appointment", ["list"]);
  if (permission.response) return permission.response;
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 100));
    const todayOnly = url.searchParams.get("date") === "today";
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const appointments = await prisma.appointment.findMany({
      where: todayOnly ? { date: { gte: start, lt: end } } : undefined,
      orderBy: [{ date: "asc" }, { time: "asc" }],
      take: limit,
      include: { patient: { select: { name: true, phone: true } }, doctor: { select: { name: true, specialty: true } } },
    });
    return NextResponse.json(appointments);
  } catch {
    return NextResponse.json({ error: "Database is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const permission = await requirePermission(request, "appointment", ["create"]);
  if (permission.response) return permission.response;
  try {
    const body = await request.json();
    if (!body.patientId || !body.date || !body.time) return NextResponse.json({ error: "Patient, date and time are required." }, { status: 422 });
    const appointment = await prisma.appointment.create({
      data: { patientId: body.patientId, doctorId: body.doctorId || null, date: new Date(`${body.date}T00:00:00`), time: body.time, status: body.status || "scheduled" },
      include: { patient: true, doctor: true },
    });
    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error("Appointment create error", error);
    return NextResponse.json({ error: "Unable to create appointment." }, { status: 500 });
  }
}
