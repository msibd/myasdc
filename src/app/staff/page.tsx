import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import StaffManagement from "./staff-management";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "superadmin") redirect("/");
  return <StaffManagement currentUserId={session.user.id} />;
}
