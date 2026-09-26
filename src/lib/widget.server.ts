/**
 * Gen 2 widget runtime helpers. Resolves installations from client_automations only.
 * Never reads automation_instances.
 */
import { createClient } from "@supabase/supabase-js";

export type Installation = {
  id: string;
  client_id: string;
  order_id: string | null;
  automation_type: string;
  domain_url: string;
  origin_domain: string;
  script_token: string;
  is_active: boolean;
  requires_reinstallation: boolean;
  widget_config: Record<string, unknown>;
};

type Admin = { from: (t: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any };

export function adminClient(): Admin {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Widget runtime is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as Admin;
}

function corsFor(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

export function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsFor(origin) } });
}
export function preflight(origin: string | null) {
  return new Response(null, { status: 204, headers: corsFor(origin) });
}
export function fail(message: string, status: number, origin: string | null = null, code = "error") {
  return json({ error: message, code }, status, origin);
}

export function hostOf(raw: string) {
  const s = (raw ?? "").trim();
  try {
    return new URL(s.includes("://") ? s : `https://${s}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Installation domain check. Origin is a spoofable browser header, so it is one layer, not the only one. */
export function originAllowed(inst: Installation, origin: string | null, appHost: string) {
  if (!origin) return false;
  const h = hostOf(origin);
  if (!h) return false;
  if (h === hostOf(appHost)) return true; // AntheticPlus preview/test panel
  const allowed = hostOf(inst.domain_url);
  return !!allowed && (h === allowed || h.endsWith(`.${allowed}`));
}

export async function resolveInstallation(admin: Admin, token: string): Promise<Installation | null> {
  if (!/^[a-f0-9]{16,64}$/i.test(token)) return null;
  const { data, error } = await admin
    .from("client_automations")
    .select("id, client_id, order_id, automation_type, domain_url, origin_domain, script_token, is_active, requires_reinstallation, widget_config")
    .eq("script_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return data as Installation;
}

export async function widgetEnabledGlobally(admin: Admin) {
  const { data } = await admin.from("system_settings").select("value").eq("key", "feature_flags").maybeSingle();
  const flags = (data?.value ?? {}) as Record<string, unknown>;
  return flags["public_widget"] !== false;
}

/** Rate limit from real message volume: max N visitor messages per automation per minute. */
export async function withinRateLimit(admin: Admin, automationId: string, perMinute = 60) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { data: convs } = await admin.from("conversations").select("id").eq("automation_id", automationId).gte("last_message_at", since).limit(200);
  const ids = ((convs ?? []) as { id: string }[]).map((c) => c.id);
  if (!ids.length) return true;
  const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).in("conversation_id", ids).eq("role", "user").gte("created_at", since);
  return (count ?? 0) < perMinute;
}

export async function buildSystemPrompt(admin: Admin, inst: Installation) {
  const [profile, kb, tasks] = await Promise.all([
    admin.from("profiles").select("company_name, website_url, category").eq("client_id", inst.client_id).maybeSingle(),
    admin.from("kb_documents").select("source_name, content, priority").eq("automation_id", inst.id).order("priority", { ascending: false }).limit(12),
    admin.from("automation_tasks").select("task_key").eq("automation_id", inst.id).eq("enabled", true),
  ]);
  const p = (profile.data ?? {}) as { company_name?: string; website_url?: string; category?: string };
  const cfg = inst.widget_config ?? {};
  const facts = ((kb.data ?? []) as { source_name: string; content: string }[])
    .map((d) => `- ${d.source_name}: ${d.content.slice(0, 1200)}`)
    .join("\n");
  const caps = ((tasks.data ?? []) as { task_key: string }[]).map((t) => t.task_key).join(", ");
  return [
    `You are the AI assistant for ${p.company_name || hostOf(inst.domain_url)} (${inst.domain_url}). Be concise, warm and accurate.`,
    typeof cfg["behavior"] === "string" && cfg["behavior"] ? `OWNER INSTRUCTIONS:\n${cfg["behavior"]}` : "",
    caps ? `ENABLED CAPABILITIES: ${caps}` : "",
    facts ? `KNOWLEDGE (highest priority first):\n${facts}` : "",
    "Rules: answer only from the knowledge above and general courtesy. Never invent prices, policies or availability. If unsure, offer to connect the visitor with a human and ask for their name and email.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
