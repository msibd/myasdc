import { NextResponse } from "next/server";
import { rolePermissions } from "@/auth/role-permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const permission = await requirePermission(request, "doctor", ["list"]);
  if (permission.response || !permission.session) return permission.response;
  try {
    const doctors = await prisma.doctor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { appointments: true } } },
    });
    const role = permission.session.user.role ?? "receptionist";
    const actions = (rolePermissions as Record<string, { doctor?: readonly string[] }>)[role]?.doctor ?? [];
    return NextResponse.json({ doctors, permissions: {
      canCreate: actions.includes("create"), canView: actions.includes("get"),
      canUpdate: actions.includes("update"), canDeactivate: actions.includes("delete"),
    } });
  } catch (error) {
    console.error("Doctor list error", error);
    return NextResponse.json({ error: "Doctor directory is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const permission = await requirePermission(request, "doctor", ["create"]);
  if (permission.response) return permission.response;
  try {
    const validation = validateDoctor(await request.json());
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 422 });
    const doctor = await prisma.doctor.create({ data: validation.data! });
    return NextResponse.json(doctor, { status: 201 });
  } catch (error) {
    if (isUniqueError(error)) return NextResponse.json({ error: "That registration number is already assigned." }, { status: 409 });
    console.error("Doctor create error", error);
    return NextResponse.json({ error: "Unable to create doctor." }, { status: 500 });
  }
}

export function validateDoctor(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request body." };
  const value = body as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name || name.length > 160) return { error: "Doctor name is required and must be under 160 characters." };
  const optional = (key: string, max: number) => {
    const raw = typeof value[key] === "string" ? (value[key] as string).trim() : "";
    if (raw.length > max) throw new Error(`${key} is too long.`);
    return raw || null;
  };
  try {
    const email = optional("email", 254)?.toLowerCase() ?? null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
    const fee = value.consultationFee === "" || value.consultationFee == null ? null : Number(value.consultationFee);
    if (fee !== null && (!Number.isFinite(fee) || fee < 0 || fee > 99999999)) return { error: "Consultation fee must be a non-negative amount." };
    return { data: { name, specialty: optional("specialty", 120), qualification: optional("qualification", 160), registrationNumber: optional("registrationNumber", 80), phone: optional("phone", 32), email, consultationFee: fee, isActive: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid doctor details." };
  }
}

function isUniqueError(error: unknown) { return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002"); }
