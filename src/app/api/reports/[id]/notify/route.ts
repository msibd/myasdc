import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";
import { decryptSmsApiKey, normalizeBangladeshMobile } from "@/lib/sms-credentials";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requirePermission(request, "report", ["deliver"]);
  if (access.response || !access.session) return access.response;
  const { id } = await context.params;
  try {
    const report = await prisma.testReport.findUnique({
      where: { id },
      select: { status: true, labOrder: { select: { id: true, patient: { select: { name: true, phone: true, isActive: true } } } } },
    });
    if (!report || !report.labOrder.patient.isActive) return NextResponse.json({ error: "Report or active patient not found." }, { status: 404, headers: noStore });
    if (!["approved", "delivered"].includes(report.status)) return NextResponse.json({ error: "Only an approved report can be notified to the patient." }, { status: 409, headers: noStore });
    const patientPhone = report.labOrder.patient.phone ? normalizeBangladeshMobile(report.labOrder.patient.phone) : "";
    if (!/^8801[3-9]\d{8}$/.test(patientPhone)) return NextResponse.json({ error: "The patient has no valid Bangladesh mobile number on file." }, { status: 422, headers: noStore });
    const settings = await prisma.centreSettings.findUnique({ where: { id: "default" }, select: { smsApiKeyEncrypted: true, smsSenderId: true, name: true } });
    if (!settings?.smsApiKeyEncrypted || !settings.smsSenderId) return NextResponse.json({ error: "SMS gateway is not configured. Contact the super administrator." }, { status: 409, headers: noStore });

    const origin = new URL(request.url).origin;
    const portalUrl = new URL("/login?view=patient-reports", origin).toString();
    const message = `${settings.name}: Your diagnostic report is ready. Reference: ${id}. Open ${portalUrl} and enter your registered mobile and reference. Do not share your report details.`;
    const form = new URLSearchParams({ api_key: decryptSmsApiKey(settings.smsApiKeyEncrypted), senderid: settings.smsSenderId, number: patientPhone, message });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let gatewayResponse: Response;
    try {
      gatewayResponse = await fetch("https://bulksmsbd.net/api/smsapi", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json, text/plain" },
        body: form.toString(), signal: controller.signal, cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }
    const providerText = (await gatewayResponse.text()).slice(0, 500);
    if (!gatewayResponse.ok || /\b(error|fail|invalid|insufficient|rejected)\b/i.test(providerText)) {
      console.warn("Report SMS notification rejected", { status: gatewayResponse.status, response: providerText.slice(0, 180) });
      return NextResponse.json({ error: "SMS gateway rejected the notification. The report remains available in the patient portal." }, { status: 502, headers: noStore });
    }

    await prisma.workflowEvent.create({ data: { labOrderId: report.labOrder.id, actorId: access.session.user.id, action: "report_sms_sent", note: "Patient notified by SMS; result content was not included." } });
    return NextResponse.json({ sent: true, recipient: `${patientPhone.slice(0, 5)}••••${patientPhone.slice(-2)}` }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return NextResponse.json({ error: "SMS gateway timed out. Check delivery status before retrying to avoid duplicate messages." }, { status: 504, headers: noStore });
    console.error("Report SMS notification failed", error);
    const message = error instanceof Error && error.message.includes("SMS_CREDENTIALS_ENCRYPTION_KEY")
      ? "SMS encryption is not configured on this server. Contact the super administrator."
      : "Unable to send patient SMS notification.";
    return NextResponse.json({ error: message }, { status: 503, headers: noStore });
  }
}
