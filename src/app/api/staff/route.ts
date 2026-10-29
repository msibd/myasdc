import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authorization";
import { rolePermissions } from "@/auth/role-permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const permission = await requireSuperAdmin(request);
  if (permission.response || !permission.session) return permission.response;
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, role: true, banned: true, createdAt: true, image: true } });
    return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "Unable to load staff directory." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const permission = await requireSuperAdmin(request);
  if (permission.response) return permission.response;
  try {
    const body = await request.json();
    if (!body.userId || !Object.hasOwn(rolePermissions, body.role)) return NextResponse.json({ error: "A valid user and role are required." }, { status: 422 });
    if (body.userId === permission.session?.user.id && body.role !== "superadmin") {
      return NextResponse.json({ error: "You cannot remove your own super administrator access." }, { status: 409 });
    }
    const user = await prisma.user.update({ where: { id: body.userId }, data: { role: body.role }, select: { id: true, name: true, email: true, role: true } });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Unable to update staff role." }, { status: 500 });
  }
}
