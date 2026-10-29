import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authorization";
import { encryptSmsApiKey } from "@/lib/sms-credentials";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  const access = await requireSuperAdmin(request);
  if (access.response || !access.session) return access.response;

  try {
    const settings = await prisma.centreSettings.findUnique({
      where: { id: "default" },
      select: { smsApiKeyEncrypted: true, smsSenderId: true },
    });
    return NextResponse.json({ configured: Boolean(settings?.smsApiKeyEncrypted), senderId: settings?.smsSenderId ?? "" }, { headers: noStore });
  } catch (error) {
    console.error("SMS gateway settings lookup failed", error);
    return NextResponse.json({ error: "Unable to load SMS gateway settings." }, { status: 503, headers: noStore });
  }
}

export async function PATCH(request: Request) {
  const access = await requireSuperAdmin(request);
  if (access.response || !access.session) return access.response;

  let payload: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    payload = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: noStore });
  }

  const senderId = typeof payload.senderId === "string" ? payload.senderId.trim() : "";
  const apiKey = typeof payload.apiKey === "string" ? payload.apiKey.trim() : "";
  if (senderId.length < 2 || senderId.length > 32) {
    return NextResponse.json({ error: "Sender ID must be between 2 and 32 characters." }, { status: 422, headers: noStore });
  }
  if (apiKey.length > 256) {
    return NextResponse.json({ error: "API key cannot exceed 256 characters." }, { status: 422, headers: noStore });
  }

  try {
    const existing = await prisma.centreSettings.findUnique({ where: { id: "default" }, select: { smsApiKeyEncrypted: true } });
    if (!apiKey && !existing?.smsApiKeyEncrypted) {
      return NextResponse.json({ error: "Enter the SMS API key before saving the gateway settings." }, { status: 422, headers: noStore });
    }

    const encryptedApiKey = apiKey ? encryptSmsApiKey(apiKey) : existing?.smsApiKeyEncrypted;
    const settings = await prisma.centreSettings.upsert({
      where: { id: "default" },
      create: { id: "default", smsApiKeyEncrypted: encryptedApiKey, smsSenderId: senderId, updatedBy: access.session.user.id },
      update: { smsApiKeyEncrypted: encryptedApiKey, smsSenderId: senderId, updatedBy: access.session.user.id },
      select: { smsSenderId: true, updatedAt: true },
    });
    return NextResponse.json({ configured: true, senderId: settings.smsSenderId, updatedAt: settings.updatedAt }, { headers: noStore });
  } catch (error) {
    console.error("SMS gateway settings update failed", error);
    const message = error instanceof Error && error.message.includes("SMS_CREDENTIALS_ENCRYPTION_KEY")
      ? "SMS encryption is not configured on this server. Set SMS_CREDENTIALS_ENCRYPTION_KEY and restart the app."
      : "Unable to save SMS gateway settings.";
    return NextResponse.json({ error: message }, { status: 503, headers: noStore });
  }
}
