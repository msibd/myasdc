import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authorization";
import { decryptSmsApiKey, normalizeBangladeshMobile } from "@/lib/sms-credentials";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: Request) {
  const access = await requireSuperAdmin(request);
  if (access.response || !access.session) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a valid mobile number and SMS message." }, { status: 400, headers: noStore });
  }
  const payload = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const number = typeof payload.number === "string" ? normalizeBangladeshMobile(payload.number) : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!/^8801[3-9]\d{8}$/.test(number)) {
    return NextResponse.json({ error: "Enter a valid Bangladesh mobile number, e.g. 017XXXXXXXX." }, { status: 422, headers: noStore });
  }
  if (!message || message.length > 1000) {
    return NextResponse.json({ error: "SMS message must be between 1 and 1000 characters." }, { status: 422, headers: noStore });
  }

  try {
    const settings = await prisma.centreSettings.findUnique({
      where: { id: "default" },
      select: { smsApiKeyEncrypted: true, smsSenderId: true },
    });
    if (!settings?.smsApiKeyEncrypted || !settings.smsSenderId) {
      return NextResponse.json({ error: "Save the SMS API key and sender ID before sending a test message." }, { status: 409, headers: noStore });
    }

    const form = new URLSearchParams({
      api_key: decryptSmsApiKey(settings.smsApiKeyEncrypted),
      senderid: settings.smsSenderId,
      number,
      message,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let response: Response;
    try {
      response = await fetch("https://bulksmsbd.net/api/smsapi", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json, text/plain" },
        body: form.toString(),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }

    const providerText = (await response.text()).slice(0, 1000);
    if (!response.ok || /\b(error|fail|invalid|insufficient|rejected)\b/i.test(providerText)) {
      console.warn("SMS test was rejected by the gateway", { status: response.status, response: providerText.slice(0, 240) });
      return NextResponse.json({ error: "The SMS gateway rejected the test message. Check the sender ID, API key, balance, and provider status." }, { status: 502, headers: noStore });
    }

    return NextResponse.json({ sent: true, number }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "The SMS gateway timed out. Check the gateway before retrying to avoid duplicate messages." }, { status: 504, headers: noStore });
    }
    console.error("SMS test send failed", error);
    const message = error instanceof Error && error.message.includes("SMS_CREDENTIALS_ENCRYPTION_KEY")
      ? "SMS encryption is not configured on this server. Set SMS_CREDENTIALS_ENCRYPTION_KEY and restart the app."
      : "Unable to send the test SMS. Check server connectivity and gateway settings.";
    return NextResponse.json({ error: message }, { status: 503, headers: noStore });
  }
}
