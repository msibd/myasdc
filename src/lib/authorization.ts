import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type Resource = "user" | "patient" | "appointment" | "doctor" | "lab" | "report" | "billing" | "inventory" | "settings" | "analytics";

export async function requireSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { session: null, response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  return { session, response: null };
}

export async function requirePermission(request: Request, resource: Resource, actions: string[]) {
  const { session, response } = await requireSession(request);
  if (response || !session) return { session: null, response };
  const result = await auth.api.userHasPermission({ body: { userId: session.user.id, permissions: { [resource]: actions } } });
  if (!result.success) return { session: null, response: NextResponse.json({ error: "You do not have permission for this action." }, { status: 403 }) };
  return { session, response: null };
}

export async function requireSuperAdmin(request: Request) {
  const { session, response } = await requireSession(request);
  if (response || !session) return { session: null, response };
  if (session.user.role !== "superadmin") {
    return { session: null, response: NextResponse.json({ error: "Only a super administrator can manage staff roles and permissions." }, { status: 403 }) };
  }
  return { session, response: null };
}
