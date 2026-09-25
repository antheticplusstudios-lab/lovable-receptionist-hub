export type WidgetInstance = {
  id: string;
  user_id: string;
  automation_slug: string;
  website_domain: string;
  status: string;
  killed: boolean;
  system_prompt: string;
  business_context: string;
  client_id: string;
  script_token: string;
  webhook_url: string;
  webhook_secret: string;
  webhook_verified: boolean;
};

type Admin = { from: (t: string) => any };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

export function fail(message: string, status: number, extra: Record<string, string> = {}) {
  return json({ error: message, ...extra }, status);
}

function hostOf(raw: string) {
  try {
    return new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? "";
  }
}

/**
 * Origin gate: the widget only answers for the domain recorded on the account,
 * so a copied snippet cannot run anywhere else.
 */
export function originAllowed(instance: WidgetInstance, origin: string | null, appHost?: string) {
  if (!origin) return false;
  // The owner's own app (dashboard "Test your receptionist" panel) may always talk to the widget.
  if (appHost && hostOf(origin) === hostOf(`https://${appHost}`)) return true;
  return hostOf(origin) === hostOf(instance.website_domain);
}

export async function resolveTenant(admin: Admin, token: string) {
  if (!/^[a-z0-9_-]{8,80}$/i.test(token)) return null;
  const { data, error } = await admin.from("automation_instances").select("*").eq("script_token", token).limit(1);
  const first = data?.[0];
  if (error || !first) return null;
  return first as WidgetInstance;
}

export async function isActive(instance: WidgetInstance) {
  return (instance.status === "active" || instance.status === "paid") && !instance.killed;
}

/** Token bucket: refills continuously, hard-stops abusive traffic. */
export async function takeTokenBucket(admin: Admin, automationId: string, capacity = 240) {
  const { data, error } = await admin.from("widget_rate_limits").select("*").eq("automation_id", automationId).limit(1);
  const now = Date.now();
  if (error && (error as { code?: string }).code !== "42P01") return { allowed: true, tokens: capacity };

  const row = data?.[0];
  if (!row) {
    await admin
      .from("widget_rate_limits")
      .upsert({ automation_id: automationId, tokens: capacity - 1, capacity, refilled_at: new Date().toISOString() });
    return { allowed: true, tokens: capacity - 1 };
  }
  const elapsedSec = Math.max(0, (now - new Date(row.refilled_at).getTime()) / 1000);
  const refill = Math.floor((elapsedSec / 60) * row.capacity);
  const tokens = Math.min(row.capacity, row.tokens + refill);
  if (tokens < 1) {
    await admin
      .from("widget_rate_limits")
      .update({ tokens, refilled_at: new Date().toISOString() })
      .eq("automation_id", automationId);
    return { allowed: false, tokens: 0 };
  }
  await admin
    .from("widget_rate_limits")
    .update({ tokens: tokens - 1, refilled_at: new Date().toISOString() })
    .eq("automation_id", automationId);
  return { allowed: true, tokens: tokens - 1 };
}

export async function systemPrompt(admin: Admin, instance: WidgetInstance) {
  const [prompts, knowledge] = await Promise.all([
    admin.from("global_prompts").select("key, content").in("key", ["system_baseline", "business_guardrail"]),
    admin
      .from("automation_knowledge")
      .select("title, content, scope")
      .eq("automation_id", instance.id)
      .eq("archived", false)
      .limit(20),
  ]);
  const promptRows = (prompts.data ?? []) as { content: string }[];
  const knowledgeRows = (knowledge.data ?? []) as { title: string; content: string; scope: string }[];
  const baseline = promptRows.map((p) => p.content).join("\n\n");
  const facts = knowledgeRows.map((k) => `- [${k.scope}] ${k.title}: ${k.content}`).join("\n");
  return [
    baseline || "You are a helpful business assistant. Be concise, warm and accurate.",
    instance.business_context ? `BUSINESS CONTEXT:\n${instance.business_context}` : "",
    instance.system_prompt ? `OWNER INSTRUCTIONS:\n${instance.system_prompt}` : "",
    facts ? `KNOWLEDGE:\n${facts}` : "",
    "Rules: answer only from the context above. Never invent prices, policies or availability. Ask for name and email before offering a booking. Escalate anything outside scope.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
