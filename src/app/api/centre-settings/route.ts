import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";

export const dynamic = "force-dynamic";
const DEFAULT_CENTRE_NAME = "MediCore Diagnostics";
const DEFAULT_LOGIN_TITLE = "Care, connected. Operations, simplified.";

// The centre name is public branding; no private settings are returned here.
export async function GET() {
  try {
    const settings = await prisma.centreSettings.findUnique({ where: { id: "default" }, select: { name: true, loginTitle: true } });
    return NextResponse.json({ name: settings?.name ?? DEFAULT_CENTRE_NAME, loginTitle: settings?.loginTitle ?? DEFAULT_LOGIN_TITLE });
  } catch (error) {
    console.error("Centre branding lookup failed", error);
    return NextResponse.json({ error: "Centre branding is unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const permission = await requirePermission(request, "settings", ["update"]);
  if (permission.response || !permission.session) return permission.response;
  if (permission.session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Only a super administrator can change the centre name." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const payload = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const loginTitle = typeof payload.loginTitle === "string" ? payload.loginTitle.trim() : DEFAULT_LOGIN_TITLE;
  if (name.length < 2 || name.length > 100) {
    return NextResponse.json({ error: "Centre name must be between 2 and 100 characters." }, { status: 422 });
  }
  if (loginTitle.length < 3 || loginTitle.length > 120) {
    return NextResponse.json({ error: "Login title must be between 3 and 120 characters." }, { status: 422 });
  }

  try {
    const settings = await prisma.centreSettings.upsert({
      where: { id: "default" },
      create: { id: "default", name, loginTitle, updatedBy: permission.session.user.id },
      update: { name, loginTitle, updatedBy: permission.session.user.id },
      select: { name: true, loginTitle: true, updatedAt: true },
    });
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Centre branding update failed", error);
    return NextResponse.json({ error: "Unable to update the centre name." }, { status: 503 });
  }
}
