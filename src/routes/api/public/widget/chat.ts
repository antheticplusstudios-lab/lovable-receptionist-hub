import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { routeChat } from "@/lib/llm-router.server";
import { fail, isActive, json, originAllowed, preflight, resolveTenant, systemPrompt, takeTokenBucket } from "@/lib/widget.server";

export const Route = createFileRoute("/api/public/widget/chat")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const admin = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        let body: z.infer<typeof Payload>;
        try {
          body = Payload.parse(await request.json());
        } catch {
          return fail("Invalid request body", 400);
        }

        const instance = await resolveTenant(admin, body.token);
        if (!instance) return fail("Unknown or expired widget token", 404);
        if (!originAllowed(instance, request.headers.get("origin"), new URL(request.url).host)) return fail("Origin not authorised", 403);
        if (!(await isActive(instance))) return fail("This automation is not active", 403);

        const bucket = await takeTokenBucket(admin, instance.id);
        if (!bucket.allowed) return fail("This website's assistant is busy. Please try again in a minute.", 429);

        const system = await systemPrompt(admin, instance);
        const history = body.history.slice(-8).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }));

        const routed = await routeChat(admin, [
          { role: "system", content: system },
          ...(history as { role: "user" | "assistant"; content: string }[]),
          { role: "user", content: body.message },
        ]);
        if (!routed) return fail("The assistant is temporarily unavailable. Please try again shortly.", 502);
        const reply = routed.reply;
        await admin.from("usage_logs").insert({ automation_id: instance.id, model: routed.model, tokens_in: routed.tokensIn, tokens_out: routed.tokensOut });
        if (!reply) return fail("The assistant returned an empty reply.", 502);

        // Persist the transcript so the client dashboard and staff queue can audit it.
        const sessionId = body.sessionId && /^[0-9a-f-]{36}$/i.test(body.sessionId) ? body.sessionId : crypto.randomUUID();
        const existing = await admin
          .from("transcripts")
          .select("id, messages")
          .eq("id", sessionId)
          .limit(1);
        const prior = existing.data?.[0];
        const messages = [
          ...((prior?.messages as unknown[]) ?? []),
          { role: "visitor", content: body.message, at: new Date().toISOString() },
          { role: "assistant", content: reply, at: new Date().toISOString() },
        ];
        if (prior) {
          await admin.from("transcripts").update({ messages }).eq("id", sessionId);
        } else {
          await admin.from("transcripts").insert({ id: sessionId, automation_id: instance.id, visitor: "widget", messages });
        }
        await admin
          .from("automation_instances")
          .update({ conversations_count: (await getConversations(admin, instance.id)) + 1 })
          .eq("id", instance.id);

        return json({ reply, sessionId, trace: crypto.randomUUID().slice(0, 8) });
      },
    },
  },
});

const Payload = z.object({
  token: z.string().min(8),
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.string().max(20), content: z.string().max(4000) }))
    .max(20)
    .optional()
    .default([]),
  sessionId: z.string().max(64).optional(),
});

async function getConversations(admin: { from: (t: string) => any }, instanceId: string) {
  const { data } = await admin.from("automation_instances").select("conversations_count").eq("id", instanceId).limit(1);
  const row = (data ?? []) as { conversations_count?: number }[];
  return Number(row[0]?.conversations_count ?? 0);
}
