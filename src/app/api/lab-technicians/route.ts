import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requirePermission(request, "lab", ["list"]);
  if (access.response) return access.response;
  try {
    const technicians = await prisma.user.findMany({
      where: { role: "lab_technician", banned: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(technicians, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Lab technician lookup failed", error);
    return NextResponse.json({ error: "Unable to load lab technician accounts." }, { status: 503 });
  }
}
