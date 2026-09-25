import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `You are an expert at writing knowledge bases for AI receptionists.
From the business website content provided, write a concise receptionist knowledge-base draft in Markdown with these sections (omit any with no information, never invent facts):
## Business overview
## Services & pricing
## Hours & location
## Booking & policies
## Frequently asked questions (Q/A pairs)
## Escalation & contact
Keep it under 600 words, factual, written so a receptionist can answer callers directly.`;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_admin", { _user_id: userId });
  if (error) throw error;
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const generateKnowledgeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ content: z.string().min(40).max(60000), businessName: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions: SYSTEM,
        input: `Business: ${data.businessName || "unknown"}\n\nWebsite content:\n${data.content}`,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
      }),
    });
    if (!res.ok || !res.body) {
      const msg = await res.text().catch(() => "");
      if (res.status === 429) return { error: "AI is busy right now — try again in a minute." };
      if (res.status === 402) return { error: "AI credits are used up. Top up in workspace billing." };
      return { error: `AI request failed (${res.status}) ${msg.slice(0, 200)}` };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    let refused = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
          if (ev.type === "response.refusal.delta") refused = true;
          if (ev.type === "error" || ev.type === "response.failed")
            return { error: ev.error?.message ?? ev.response?.error?.message ?? "AI generation failed" };
        } catch {}
      }
    }
    if (refused && !text) return { error: "The AI declined to process this content." };
    if (!text.trim()) return { error: "The AI returned an empty draft. Try adding more website content." };
    return { draft: text.trim() };
  });

export const saveKnowledgeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ automationId: z.string().uuid(), title: z.string().min(1).max(200), content: z.string().min(1).max(20000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("automation_knowledge").insert({
      automation_id: data.automationId,
      scope: "ai_draft",
      title: data.title,
      content: data.content,
    } as any);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({
      actor_id: context.userId,
      action: "knowledge_draft_saved",
      target: data.automationId,
      details: { title: data.title },
    } as any);
    return { ok: true };
  });
