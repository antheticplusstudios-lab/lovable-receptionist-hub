/**
 * LLM router for the live chat widget.
 * 1. Groq key pool (owner-managed in the admin panel): primary first, round-robin on 429/5xx,
 *    failing keys get a 60s cooldown and a failover log entry.
 * 2. If no Groq key works, falls back to Lovable AI so the receptionist never goes silent.
 */
type Admin = { from: (t: string) => any };
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const GROQ_MODEL = "llama-3.1-8b-instant";

async function tryGroq(admin: Admin, messages: ChatMsg[]) {
  const { data } = await admin
    .from("groq_keys")
    .select("id, key_value, is_primary, cooldown_until, request_count, error_count")
    .eq("enabled", true)
    .order("is_primary", { ascending: false })
    .order("last_used_at", { ascending: true, nullsFirst: true });
  const now = Date.now();
  const keys = ((data ?? []) as any[]).filter((k) => !k.cooldown_until || new Date(k.cooldown_until).getTime() < now);

  for (const k of keys) {
    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${k.key_value}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 500, temperature: 0.4 }),
      });
    } catch (e) {
      await admin.from("groq_failover_log").insert({ key_id: k.id, status_code: 0, message: String(e).slice(0, 300) });
      continue;
    }
    if (res.ok) {
      const j = (await res.json()) as any;
      const reply = j.choices?.[0]?.message?.content?.trim() ?? "";
      await admin
        .from("groq_keys")
        .update({ request_count: (k.request_count ?? 0) + 1, last_used_at: new Date().toISOString() })
        .eq("id", k.id);
      if (reply) return { reply, model: `groq/${GROQ_MODEL}`, tokensIn: j.usage?.prompt_tokens ?? 0, tokensOut: j.usage?.completion_tokens ?? 0 };
      continue;
    }
    const msg = (await res.text().catch(() => "")).slice(0, 300);
    const retryable = res.status === 429 || res.status >= 500 || res.status === 401 || res.status === 403;
    await admin.from("groq_failover_log").insert({ key_id: k.id, status_code: res.status, message: msg });
    await admin
      .from("groq_keys")
      .update({
        error_count: (k.error_count ?? 0) + 1,
        cooldown_until: new Date(now + (res.status === 429 ? 60_000 : 300_000)).toISOString(),
      })
      .eq("id", k.id);
    if (!retryable) break;
  }
  return null;
}

async function tryLovable(messages: ChatMsg[]) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }] }));
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: "openai/gpt-6-astra", instructions: system, input, stream: true, store: false, reasoning: { effort: "low" } }),
  });
  if (!res.ok || !res.body) return null;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
      } catch {}
    }
  }
  return text.trim() ? { reply: text.trim(), model: "lovable/gpt-6-astra", tokensIn: 0, tokensOut: 0 } : null;
}

export async function routeChat(admin: Admin, messages: ChatMsg[]) {
  return (await tryGroq(admin, messages)) ?? (await tryLovable(messages));
}
