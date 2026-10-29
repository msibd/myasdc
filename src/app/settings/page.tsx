"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, Save, ShieldCheck, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useCentreName, centreSettingsQueryKey } from "@/components/centre-name";
import { Card } from "@/components/ui";

export default function CentreSettingsPage() {
  const session = authClient.useSession();
  const settings = useCentreName();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [smsApiKey, setSmsApiKey] = useState("");
  const [testNumber, setTestNumber] = useState("");
  const [testMessage, setTestMessage] = useState("This is a test SMS from your diagnostic centre.");
  const isSuperAdmin = session.data?.user?.role === "superadmin";
  const smsSettings = useQuery({
    queryKey: ["centre-settings", "sms"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const response = await fetch("/api/centre-settings/sms", { cache: "no-store" });
      const result = await response.json().catch(() => null) as { configured?: boolean; senderId?: string; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to load SMS settings.");
      return { configured: result?.configured ?? false, senderId: result?.senderId ?? "" };
    },
  });

  const updateName = useMutation({
    mutationFn: async (value: { name: string; loginTitle: string }) => {
      const response = await fetch("/api/centre-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const result = await response.json().catch(() => null) as { name?: string; loginTitle?: string; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to save centre name.");
      return result as { name: string; loginTitle: string };
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(centreSettingsQueryKey, { name: result.name, loginTitle: result.loginTitle });
      await queryClient.invalidateQueries({ queryKey: centreSettingsQueryKey });
      setSaved(true);
      setError("");
    },
    onError: (cause: Error) => { setError(cause.message); setSaved(false); },
  });

  const updateSmsSettings = useMutation({
    mutationFn: async (value: { apiKey: string; senderId: string }) => {
      const response = await fetch("/api/centre-settings/sms", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const result = await response.json().catch(() => null) as { configured?: boolean; senderId?: string; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to save SMS gateway settings.");
      return { configured: result?.configured ?? false, senderId: result?.senderId ?? value.senderId };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["centre-settings", "sms"], result);
      setSmsApiKey("");
      toast.success("SMS gateway settings saved securely.");
    },
    onError: (cause: Error) => toast.error(cause.message),
  });

  const sendTestSms = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/centre-settings/sms/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: testNumber, message: testMessage }),
      });
      const result = await response.json().catch(() => null) as { sent?: boolean; number?: string; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to send test SMS.");
      return result;
    },
    onSuccess: (result) => toast.success(`Test SMS accepted for ${result?.number ?? "the recipient"}.`),
    onError: (cause: Error) => toast.error(cause.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setError("");
    const form = new FormData(event.currentTarget);
    updateName.mutate({ name: String(form.get("name") ?? "").trim(), loginTitle: String(form.get("loginTitle") ?? "").trim() });
  }

  function submitSmsSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateSmsSettings.mutate({ apiKey: smsApiKey.trim(), senderId: String(form.get("senderId") ?? "").trim() });
  }

  return <main className="min-h-screen bg-surface p-5 sm:p-8"><div className="mx-auto max-w-4xl">
    <div className="mb-6"><Link href="/" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary"><ArrowLeft size={15}/> Dashboard</Link><h1 className="text-2xl font-bold text-slate-900">Centre settings</h1><p className="mt-1 text-sm text-slate-600">Manage the diagnostic centre identity displayed across the application.</p></div>
    {!isSuperAdmin ? <Card className="flex items-start gap-3 border border-warning/30 p-5"><div role="alert" className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-warning" size={20}/><div><h2 className="font-semibold text-slate-900">Super administrator access required</h2><p className="mt-1 text-sm text-slate-600">Only a super administrator can change the diagnostic centre name or SMS gateway settings.</p></div></div></Card> : <div className="max-w-2xl space-y-6"><Card className="p-5 sm:p-7">
      <div className="mb-5 flex items-start gap-3"><span className="rounded-xl bg-primary-light p-2 text-primary-dark"><Stethoscope size={20}/></span><div><h2 className="font-bold text-slate-900">Diagnostic centre identity</h2><p className="mt-1 text-sm text-slate-600">The centre name appears across the workspace; the title appears on the login page.</p></div></div>
      {settings.isError && <div role="alert" className="mb-4 rounded-xl bg-danger-light p-3 text-sm text-[#8f3d2e]">{settings.error.message}<button onClick={() => settings.refetch()} className="ml-2 font-semibold underline">Retry</button></div>}
      <form key={`${settings.data?.name ?? ""}:${settings.data?.loginTitle ?? ""}`} onChange={() => setSaved(false)} onSubmit={submit} className="space-y-4"><label className="block text-sm font-semibold text-slate-800">Centre name<input required minLength={2} maxLength={100} name="name" defaultValue={settings.data?.name ?? ""} disabled={settings.isLoading} placeholder="e.g. MediCore Diagnostics" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-500 focus:border-primary disabled:opacity-60"/><span className="mt-1 block text-xs font-normal text-slate-600">2–100 characters. Keep it short enough to fit in the sidebar.</span></label>
        <label className="block text-sm font-semibold text-slate-800">Login page title<textarea required minLength={3} maxLength={120} name="loginTitle" rows={3} defaultValue={settings.data?.loginTitle ?? "Care, connected. Operations, simplified."} disabled={settings.isLoading} placeholder="Welcome to your diagnostic centre" className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-500 focus:border-primary disabled:opacity-60"/><span className="mt-1 block text-xs font-normal text-slate-600">3–120 characters. Use line breaks to control the heading layout.</span></label>
        {error && <p role="alert" className="rounded-xl bg-danger-light p-3 text-sm text-[#8f3d2e]">{error}</p>}{saved && <p role="status" className="rounded-xl bg-success-light p-3 text-sm font-medium text-slate-800">Centre name updated successfully.</p>}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-600">Changes are saved for all signed-in staff and future login pages.</p><button disabled={updateName.isPending || settings.isLoading || !settings.data?.name} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"><Save size={16}/>{updateName.isPending ? "Saving…" : "Save changes"}</button></div>
      </form>
    </Card>
    <Card className="p-5 sm:p-7">
      <div className="mb-5 flex items-start gap-3"><span className="rounded-xl bg-primary-light p-2 text-primary-dark"><Mail size={20}/></span><div><h2 className="font-bold text-slate-900">SMS gateway</h2><p className="mt-1 text-sm text-slate-600">Configure BulkSMSBD credentials for patient notifications.</p></div></div>
      {smsSettings.isError && <div role="alert" className="mb-4 rounded-xl bg-danger-light p-3 text-sm text-[#8f3d2e]">{smsSettings.error.message}<button type="button" onClick={() => void smsSettings.refetch()} className="ml-2 font-semibold underline">Retry</button></div>}
      <form key={smsSettings.data?.senderId ?? "sms-settings"} onSubmit={submitSmsSettings} className="space-y-4">
        <label className="block text-sm font-semibold text-slate-800">BulkSMSBD API key<input type="password" autoComplete="new-password" value={smsApiKey} onChange={(event) => setSmsApiKey(event.target.value)} required={!smsSettings.data?.configured} maxLength={256} placeholder={smsSettings.data?.configured ? "Saved securely · enter a new key to replace" : "Enter your API key"} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-500 focus:border-primary"/><span className="mt-1 block text-xs font-normal text-slate-600">{smsSettings.data?.configured ? "The saved key is encrypted and never shown again. Leave blank to keep it." : "Required to activate SMS gateway settings."}</span></label>
        <label className="block text-sm font-semibold text-slate-800">Approved sender ID<input required minLength={2} maxLength={32} name="senderId" defaultValue={smsSettings.data?.senderId || "8809648911030"} placeholder="e.g. 8809648911030" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-500 focus:border-primary"/></label>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-600">{smsSettings.data?.configured ? "Gateway credentials are configured." : "Credentials are saved encrypted at rest."}</p><button disabled={updateSmsSettings.isPending || smsSettings.isLoading} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"><Save size={16}/>{updateSmsSettings.isPending ? "Saving…" : "Save SMS settings"}</button></div>
      </form>
      {smsSettings.data?.configured && <form onSubmit={(event) => { event.preventDefault(); sendTestSms.mutate(); }} className="mt-6 space-y-4 border-t border-slate-100 pt-5">
        <div><h3 className="font-semibold text-slate-900">Send a test SMS</h3><p className="mt-1 text-sm text-slate-600">This sends one real SMS and may incur a gateway charge. Use a number you control.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-800">Bangladesh mobile number<input required type="tel" autoComplete="tel" value={testNumber} onChange={(event) => setTestNumber(event.target.value)} maxLength={24} placeholder="017XXXXXXXX" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-500 focus:border-primary"/></label>
          <label className="block text-sm font-semibold text-slate-800">Message<input required value={testMessage} onChange={(event) => setTestMessage(event.target.value)} maxLength={1000} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-primary"/><span className="mt-1 block text-xs font-normal text-slate-600">{testMessage.length}/1000 characters</span></label>
        </div>
        <div className="flex justify-end"><button type="submit" disabled={sendTestSms.isPending || updateSmsSettings.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">{sendTestSms.isPending ? "Sending…" : "Send test SMS"}</button></div>
      </form>}
    </Card></div>}
  </div></main>;
}
