import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StatusPill, timeAgo } from "@/components/admin-ui";
import { WidgetCustomizer } from "@/components/widget-customizer";
import { supabase } from "@/integrations/supabase/client";
import { AUTOMATION_LABEL, MESSAGING_FEATURES, RECEPTIONIST_CAPABILITIES, embedSnippet } from "@/lib/catalog-v2";

export const Route = createFileRoute("/_authenticated/dashboard/portal/$id")({
  head: () => ({ meta: [{ title: "Automation Portal — AntheticPlus" }] }),
  component: PortalPage,
});

const TABS = ["Overview", "Inbox & CRM", "Knowledge Base", "Features", "Widget", "Integrations"] as const;
const FASTAPI_BASE = "https://api.antheticplus.com";

function copy(text: string) {
  void navigator.clipboard.writeText(text);
  toast.success("Copied");
}

function PortalPage() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const qc = useQueryClient();
  const auto = useQuery({
    queryKey: ["ca", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_automations").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const a = auto.data;
  if (!a) return <p className="text-muted-foreground">{auto.isError ? "Automation not found." : "Loading…"}</p>;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">{AUTOMATION_LABEL[a.automation_type]}</h1>
        <p className="text-sm text-muted-foreground">{a.domain_url} · {a.client_id} · {a.order_id}</p>
      </div>
      {a.requires_reinstallation && (
        <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <TriangleAlert className="h-4 w-4" /> Your settings changed and the script was rotated. Reinstall the new snippet below.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t} size="sm" variant={t === tab ? "default" : "outline"} onClick={() => setTab(t)}>{t}</Button>
        ))}
      </div>
      {tab === "Overview" && <Overview a={a} />}
      {tab === "Inbox & CRM" && <Inbox automationId={id} />}
      {tab === "Knowledge Base" && <Knowledge automationId={id} clientId={a.client_id} />}
      {tab === "Features" && <Features automationId={id} type={a.automation_type} />}
      {tab === "Widget" && <WidgetCustomizer automationId={id} initial={a.widget_config} onSaved={() => void qc.invalidateQueries({ queryKey: ["ca", id] })} />}
      {tab === "Integrations" && <Integrations automationId={id} clientId={a.client_id} />}
    </div>
  );
}

type Auto = { id: string; client_id: string; order_id: string | null; script_token: string; assigned_phone_number: string | null };

function Overview({ a }: { a: Auto }) {
  const usage = useQuery({
    queryKey: ["usage", a.id],
    queryFn: async () => {
      const period = new Date().toISOString().slice(0, 7);
      const { data } = await supabase.from("usage_meters").select("*").eq("automation_id", a.id).eq("billing_period", period).maybeSingle();
      return data;
    },
  });
  const snippet = embedSnippet(a.client_id, a.order_id, a.script_token);
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Install script</h2><Button size="sm" variant="outline" onClick={() => copy(snippet)}><Copy className="h-4 w-4" /> Copy</Button></div>
        <pre className="overflow-auto rounded-xl bg-muted p-3 text-xs">{snippet}</pre>
        <p className="mt-2 text-xs text-muted-foreground">Paste before the closing body tag. The script can't be edited here.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Phone number" value={a.assigned_phone_number ?? "Not assigned"} action={a.assigned_phone_number ? () => copy(a.assigned_phone_number!) : undefined} />
        <Stat label="Tokens this month" value={(usage.data?.tokens_used ?? 0).toLocaleString()} />
        <Stat label="Call minutes" value={String(usage.data?.call_minutes_used ?? 0)} />
        <Stat label="SMS sent" value={String(usage.data?.sms_count_used ?? 0)} />
      </div>
    </div>
  );
}

function Stat({ label, value, action }: { label: string; value: string; action?: (() => void) | undefined }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center justify-between font-bold">{value}{action && <Button size="icon" variant="ghost" onClick={action}><Copy className="h-4 w-4" /></Button>}</div>
    </div>
  );
}

function Inbox({ automationId }: { automationId: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const convs = useQuery({
    queryKey: ["convs", automationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("conversations").select("*").eq("automation_id", automationId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  const msgs = useQuery({
    queryKey: ["msgs", sel],
    enabled: !!sel,
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("conversation_id", sel!).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const current = convs.data?.find((c) => c.id === sel);
  const lead = (current?.extracted_lead_data ?? {}) as Record<string, string>;
  return (
    <div className="grid min-h-96 gap-4 lg:grid-cols-[260px_1fr_220px]">
      <div className="grid content-start gap-2">
        {(convs.data ?? []).map((c) => (
          <button key={c.id} onClick={() => setSel(c.id)} className={`rounded-xl border p-3 text-left text-sm ${sel === c.id ? "border-primary" : "border-border"}`}>
            <div className="font-semibold">{c.customer_phone_or_id ?? "Visitor"}</div>
            <div className="text-xs text-muted-foreground">{c.channel} · {timeAgo(c.created_at)}</div>
          </button>
        ))}
        {convs.data?.length === 0 && <p className="text-sm text-muted-foreground">No conversations yet.</p>}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        {current ? (
          <div className="grid gap-3">
            <StatusPill status={current.status} />
            {current.audio_recording_url && <audio controls src={current.audio_recording_url} className="w-full" />}
            {(msgs.data ?? []).map((m) => (
              <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === "assistant" ? "bg-muted" : "ml-auto bg-primary text-primary-foreground"}`}>{m.content}</div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">Select a conversation.</p>}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 text-sm">
        <h3 className="mb-2 font-bold">Extracted Lead Data</h3>
        {["name", "phone", "email", "intent", "budget"].map((k) => (
          <div key={k} className="flex justify-between border-b border-border py-1.5"><span className="capitalize text-muted-foreground">{k}</span><span className="font-semibold">{lead[k] ?? "—"}</span></div>
        ))}
      </div>
    </div>
  );
}

function Knowledge({ automationId, clientId }: { automationId: string; clientId: string }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [drag, setDrag] = useState(false);
  const docs = useQuery({
    queryKey: ["kb", automationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("kb_documents").select("id, source_type, source_name, created_at").eq("automation_id", automationId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const jobs = useQuery({
    queryKey: ["crawl", automationId],
    queryFn: async () => {
      const { data } = await supabase.from("crawl_jobs").select("*").eq("automation_id", automationId).order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["kb", automationId] }); void qc.invalidateQueries({ queryKey: ["crawl", automationId] }); };

  async function scrape() {
    if (!/^https?:\/\//.test(url)) return toast.error("Enter a full URL starting with https://");
    const { error } = await supabase.from("crawl_jobs").insert({ automation_id: automationId, target_url: url });
    if (error) return toast.error(error.message);
    toast.success("Scrape queued");
    setUrl("");
    refresh();
  }
  async function upload(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} is over 20MB`); continue; }
      const path = `${clientId}/${automationId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("kb-uploads").upload(path, file);
      if (up.error) { toast.error(up.error.message); continue; }
      const text = file.type.startsWith("text/") ? (await file.text()).slice(0, 100000) : "";
      const { error } = await supabase.from("kb_documents").insert({ automation_id: automationId, source_type: file.type === "application/pdf" ? "pdf_upload" : "manual_text", source_name: file.name, content: text, storage_path: path });
      if (error) toast.error(error.message); else toast.success(`${file.name} uploaded`);
    }
    refresh();
  }
  async function remove(docId: string) {
    const { error } = await supabase.from("kb_documents").delete().eq("id", docId);
    if (error) return toast.error(error.message);
    refresh();
  }
  return (
    <div className="grid gap-4">
      <div className="flex gap-2"><Input placeholder="https://yourbusiness.com/menu" value={url} onChange={(e) => setUrl(e.target.value)} /><Button onClick={scrape}>Scrape Website</Button></div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }}
        className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-10 text-sm ${drag ? "border-primary bg-primary/5" : "border-border"}`}
      >
        <Upload className="mb-2 h-6 w-6 text-muted-foreground" /> Drop PDFs, menus or text files here, or click to choose
        <input type="file" multiple accept=".pdf,.txt,.md,.csv" className="hidden" onChange={(e) => void upload(e.target.files)} />
      </label>
      {(jobs.data ?? []).length > 0 && (
        <div className="text-sm"><h3 className="mb-1 font-bold">Scrape jobs</h3>{jobs.data!.map((j) => <div key={j.id} className="flex justify-between py-1"><span>{j.target_url}</span><StatusPill status={j.status} /></div>)}</div>
      )}
      <div className="grid gap-2">
        {(docs.data ?? []).map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
            <span className="flex-1 font-semibold">{d.source_name}</span><span className="text-xs text-muted-foreground">{d.source_type} · {timeAgo(d.created_at)}</span>
            {d.source_type !== "override_rule" && <Button size="icon" variant="ghost" onClick={() => void remove(d.id)}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Features({ automationId, type }: { automationId: string; type: string }) {
  const qc = useQueryClient();
  const list = type === "messaging_ai" ? MESSAGING_FEATURES : RECEPTIONIST_CAPABILITIES;
  const tasks = useQuery({
    queryKey: ["tasks", automationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("automation_tasks").select("*").eq("automation_id", automationId);
      if (error) throw error;
      return data;
    },
  });
  const byKey = new Map((tasks.data ?? []).map((t) => [t.task_key, t]));
  async function toggle(key: string, enabled: boolean) {
    const { error } = await supabase.from("automation_tasks").upsert({ automation_id: automationId, task_key: key, enabled }, { onConflict: "automation_id,task_key" });
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["tasks", automationId] });
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {list.map((c) => (
        <div key={c.key} className="flex items-start gap-3 rounded-xl border border-border p-3">
          <div className="flex-1"><div className="text-sm font-bold">{c.label}</div><div className="text-xs text-muted-foreground">{c.desc}</div></div>
          <Switch checked={byKey.get(c.key)?.enabled ?? false} onCheckedChange={(v) => void toggle(c.key, v)} />
        </div>
      ))}
    </div>
  );
}

function Integrations({ automationId, clientId }: { automationId: string; clientId: string }) {
  const status = useQuery({
    queryKey: ["integrations", automationId],
    queryFn: async () => {
      const { data } = await supabase.rpc("integration_status", { _automation_id: automationId });
      return data ?? [];
    },
  });
  const connected = new Set((status.data ?? []).filter((s) => s.status === "connected").map((s) => s.provider));
  const items = [
    { key: "google_calendar", label: "Google Calendar", href: `${FASTAPI_BASE}/v1/auth/google/login?client_id=${clientId}&automation_id=${automationId}` },
    { key: "meta_page", label: "Meta Facebook Page", href: `${FASTAPI_BASE}/v1/auth/meta/login?client_id=${clientId}&automation_id=${automationId}` },
    { key: "whatsapp", label: "WhatsApp Business", href: `${FASTAPI_BASE}/v1/auth/whatsapp/login?client_id=${clientId}&automation_id=${automationId}` },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.key} className="rounded-2xl border border-border bg-card p-4">
          <div className="font-bold">{i.label}</div>
          <div className="my-2"><StatusPill status={connected.has(i.key) ? "connected" : "not connected"} /></div>
          <Button asChild size="sm" variant={connected.has(i.key) ? "outline" : "default"}><a href={i.href}>{connected.has(i.key) ? "Reconnect" : "Connect"}</a></Button>
        </div>
      ))}
    </div>
  );
}
