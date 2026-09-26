import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { routeChat } from "@/lib/llm-router.server";
import {
  adminClient,
  buildSystemPrompt,
  fail,
  json,
  originAllowed,
  preflight,
  resolveInstallation,
  widgetEnabledGlobally,
  runtimeState,
  withinRateLimit,
} from "@/lib/widget.server";

const Payload = z.object({
  token: z.string().min(16).max(64),
  message: z.string().trim().min(1).max(2000),
  sessionId: z.string().regex(/^[a-zA-Z0-9-]{16,64}$/),
});

export const Route = createFileRoute("/api/public/widget/chat")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request.headers.get("origin")),
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        let body: z.infer<typeof Payload>;
        try {
          body = Payload.parse(await request.json());
        } catch {
          return fail("Invalid request", 400, origin, "bad_request");
        }
        let admin;
        try {
          admin = adminClient();
        } catch {
          return fail("Assistant unavailable", 503, origin, "offline");
        }
        if (!(await widgetEnabledGlobally(admin))) return fail("Assistant is offline", 503, origin, "offline");
        const inst = await resolveInstallation(admin, body.token);
        if (!inst) return fail("Unknown installation", 404, origin, "invalid_token");
        if (!originAllowed(inst, origin, new URL(request.url).host)) return fail("Domain not authorised", 403, origin, "domain");
        const rs = await runtimeState(admin, inst.id);
        if (rs !== "active") return fail("This assistant is not available", 403, origin, "inactive");
        if (!(await withinRateLimit(admin, inst.id))) return fail("Too many messages, try again shortly", 429, origin, "rate_limited");

        // Conversation (one per visitor session per installation)
        const { data: existing } = await admin
          .from("conversations")
          .select("id, status")
          .eq("automation_id", inst.id)
          .eq("visitor_session", body.sessionId)
          .maybeSingle();
        let convId = existing?.id as string | undefined;
        if (!convId) {
          const { data: created, error } = await admin
            .from("conversations")
            .insert({ automation_id: inst.id, channel: "web_chat", visitor_session: body.sessionId, origin: origin ?? "", status: "active" })
            .select("id")
            .single();
          if (error || !created) return fail("Could not start conversation", 500, origin);
          convId = created.id;
        }
        await admin.from("messages").insert({ conversation_id: convId, role: "user", content: body.message });

        const { data: hist } = await admin
          .from("messages")
          .select("role, content")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: false })
          .limit(12);
        const history = ((hist ?? []) as { role: "user" | "assistant"; content: string }[]).reverse();

        const system = await buildSystemPrompt(admin, inst);
        const routed = await routeChat(admin, [{ role: "system", content: system }, ...history], { automationId: inst.id });
        const now = new Date().toISOString();
        await admin.from("client_automations").update({ last_seen_at: now, last_seen_origin: origin ?? "" }).eq("id", inst.id);
        if (!routed) {
          await admin.from("conversations").update({ last_message_at: now }).eq("id", convId);
          return fail("The assistant is temporarily unavailable", 502, origin, "provider");
        }
        await admin.from("messages").insert({ conversation_id: convId, role: "assistant", content: routed.reply, tokens_used: routed.tokensIn + routed.tokensOut });
        await admin.from("conversations").update({ last_message_at: now }).eq("id", convId);
        await admin.rpc("record_usage", { _automation_id: inst.id, _tokens: routed.tokensIn + routed.tokensOut });

        return json({ reply: routed.reply, conversationId: convId }, 200, origin);
      },
    },
  },
});
