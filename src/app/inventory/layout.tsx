import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InventoryLayout({ children }: LayoutProps<"/inventory">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const access = await auth.api.userHasPermission({
    body: { userId: session.user.id, permissions: { inventory: ["list"] } },
  });
  if (!access.success) redirect("/");

  return children;
}
