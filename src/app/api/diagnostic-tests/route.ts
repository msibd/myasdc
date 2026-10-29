import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const permission = await requirePermission(request, "lab", ["list"]);
  if (permission.response) return permission.response;
  try {
    return NextResponse.json(await prisma.diagnosticTest.findMany({ where: { isActive: true }, orderBy: [{ department: "asc" }, { name: "asc" }] }));
  } catch {
    return NextResponse.json({ error: "Database is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const permission = await requirePermission(request, "lab", ["create"]);
  if (permission.response) return permission.response;
  try {
    const body = await request.json();
    if (!body.name?.trim() || !body.department?.trim() || !body.price) return NextResponse.json({ error: "Name, department and price are required." }, { status: 422 });
    return NextResponse.json(await prisma.diagnosticTest.create({ data: { name: body.name.trim(), department: body.department.trim(), price: Number(body.price) } }), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create diagnostic test." }, { status: 500 });
  }
}
