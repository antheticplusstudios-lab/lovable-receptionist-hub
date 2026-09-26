/**
 * Canonical LLM router (Gen 2). Every AI request goes through routeChat().
 * Order: active llm_api_keys by priority (skipping cooled-down keys) → Lovable AI fallback.
 * Each attempt is written to llm_requests (latency, status, tokens, error) and updates key health.
 */
type Admin = { from: (t: string) => any };
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
export type RouteResult = { reply: string; provider: string; model: string; tokensIn: number; tokensOut: number };

const ENDPOINT: Record<string, { url: string; model: string }> = {
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.1-8b-instant" },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o-mini" },
};
const LOVABLE_MODEL = "openai/gpt-6-astra";

type Opts = { automationId?: string | null; maxTokens?: number; temperature?: number };

async function log(admin: Admin, row: Record<string, unknown>) {
  await admin.from("llm_requests").insert(row);
}

async function tryKeys(admin: Admin, messages: ChatMsg[], o: Opts): Promise<RouteResult | null> {
  const { data } = await admin
    .from("llm_api_keys")
    .select("id, provider, api_key, model, cooldown_until, request_count, error_count")
    .eq("is_active", true)
    .in("provider", ["groq", "openrouter"])
    .order("priority", { ascending: true });
  const now = Date.now();
  const keys = ((data ?? []) as any[]).filter((k) => !k.cooldown_until || new Date(k.cooldown_until).getTime() < now);
  for (const k of keys) {
    const ep = ENDPOINT[k.provider];
    if (!ep) continue;
    const model = k.model || ep.model;
    const t0 = Date.now();
    let res: Response | null = null;
    let err = "";
    try {
      res = await fetch(ep.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${k.api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, max_tokens: o.maxTokens ?? 600, temperature: o.temperature ?? 0.4 }),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (e) {
      err = String(e).slice(0, 300);
    }
    const latency = Date.now() - t0;
    if (res?.ok) {
      const j = (await res.json()) as any;
      const reply = j.choices?.[0]?.message?.content?.trim() ?? "";
      const tin = j.usage?.prompt_tokens ?? 0;
      const tout = j.usage?.completion_tokens ?? 0;
      await admin.from("llm_api_keys").update({ request_count: (k.request_count ?? 0) + 1, last_success_at: new Date().toISOString() }).eq("id", k.id);
      await log(admin, { automation_id: o.automationId ?? null, key_id: k.id, provider: k.provider, model, status: reply ? "ok" : "empty", http_status: 200, latency_ms: latency, tokens_in: tin, tokens_out: tout });
      if (reply) return { reply, provider: k.provider, model, tokensIn: tin, tokensOut: tout };
      continue;
    }
    const status = res?.status ?? 0;
    if (res) err = (await res.text().catch(() => "")).slice(0, 300);
    await log(admin, { automation_id: o.automationId ?? null, key_id: k.id, provider: k.provider, model, status: "error", http_status: status, latency_ms: latency, error: err });
    await admin
      .from("llm_api_keys")
      .update({
        error_count: (k.error_count ?? 0) + 1,
        last_error: `${status} ${err}`.slice(0, 300),
        last_error_at: new Date().toISOString(),
        cooldown_until: new Date(now + (status === 429 ? 60_000 : 300_000)).toISOString(),
      })
      .eq("id", k.id);
  }
  return null;
}

async function tryLovable(admin: Admin, messages: ChatMsg[], o: Opts): Promise<RouteResult | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }] }));
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: LOVABLE_MODEL, instructions: system, input, store: false, reasoning: { effort: "low" }, max_output_tokens: 2000 }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    await log(admin, { automation_id: o.automationId ?? null, provider: "lovable", model: LOVABLE_MODEL, status: "error", latency_ms: Date.now() - t0, error: String(e).slice(0, 300) });
    return null;
  }
  const latency = Date.now() - t0;
  if (!res.ok) {
    await log(admin, { automation_id: o.automationId ?? null, provider: "lovable", model: LOVABLE_MODEL, status: "error", http_status: res.status, latency_ms: latency, error: (await res.text().catch(() => "")).slice(0, 300) });
    return null;
  }
  const j = (await res.json()) as any;
  let text = typeof j.output_text === "string" ? j.output_text : "";
  if (!text) {
    for (const item of j.output ?? []) for (const c of item.content ?? []) if (c.type === "output_text") text += c.text ?? "";
  }
  const tin = j.usage?.input_tokens ?? 0;
  const tout = j.usage?.output_tokens ?? 0;
  await log(admin, { automation_id: o.automationId ?? null, provider: "lovable", model: LOVABLE_MODEL, status: text ? "ok" : "empty", http_status: 200, latency_ms: latency, tokens_in: tin, tokens_out: tout });
  return text.trim() ? { reply: text.trim(), provider: "lovable", model: LOVABLE_MODEL, tokensIn: tin, tokensOut: tout } : null;
}

export async function routeChat(admin: Admin, messages: ChatMsg[], opts: Opts = {}) {
  return (await tryKeys(admin, messages, opts)) ?? (await tryLovable(admin, messages, opts));
}
