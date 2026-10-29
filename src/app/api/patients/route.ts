import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";
import { rolePermissions } from "@/auth/role-permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const permission = await requirePermission(request, "patient", ["list"]);
  if (permission.response || !permission.session) return permission.response;
  try {
    const patients = await prisma.patient.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" }, take: 100 });
    const role = permission.session.user.role ?? "receptionist";
    const actions = (rolePermissions as Record<string, { patient?: readonly string[] }>)[role]?.patient ?? [];
    return NextResponse.json({
      patients,
      permissions: {
        canCreate: actions.includes("create"),
        canView: actions.includes("get"),
        canUpdate: actions.includes("update"),
        canArchive: actions.includes("delete"),
      },
    });
  } catch (error) {
    console.error("Patient list error", error);
    return NextResponse.json({ error: "Database is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const permission = await requirePermission(request, "patient", ["create"]);
  if (permission.response) return permission.response;
  try {
    const body = await request.json();
    const validation = validatePatient(body);
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 422 });

    const patient = await prisma.patient.create({
      data: { ...validation.data!, isActive: true },
    });
    return NextResponse.json(patient, { status: 201 });
  } catch (error) {
    console.error("Patient create error", error);
    return NextResponse.json({ error: "Unable to create patient." }, { status: 500 });
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

