import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * "Test your receptionist": the signed-in client (or staff) chats with their own
 * automation using the exact same prompt + knowledge as the live widget.
 * Nothing is written to transcripts or counters.
 */
export const testReceptionist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        automationId: z.string().uuid(),
        message: z.string().min(1).max(2000),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
          .max(20)
          .default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // RLS: clients only see their own automations, staff see all.
    const { data: rows, error } = await context.supabase
      .from("automation_instances")
      .select("id")
      .eq("id", data.automationId)
      .limit(1);
    if (error) throw new Error(error.message);
    if (!rows?.length) return { error: "Automation not found." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { systemPrompt } = await import("./widget.server");
    const { routeChat } = await import("./llm-router.server");
    const { data: inst } = await supabaseAdmin.from("automation_instances").select("*").eq("id", data.automationId).single();
    if (!inst) return { error: "Automation not found." };

    const system = await systemPrompt(supabaseAdmin as never, inst as never);
    const routed = await routeChat(supabaseAdmin as never, [
      { role: "system", content: system },
      ...data.history.slice(-8),
      { role: "user", content: data.message },
    ]);
    if (!routed?.reply) return { error: "The assistant is temporarily unavailable. Try again in a moment." };
    return { reply: routed.reply, model: routed.model };
  });

/** Knowledge Drafts: pull readable text from any public web page. Admin only. */
export const scrapeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().min(4).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!ok) return { error: "Only owners and partners can scrape pages." };
    let target: URL;
    try {
      target = new URL(/^https?:\/\//i.test(data.url) ? data.url : `https://${data.url}`);
    } catch {
      return { error: "That doesn't look like a valid web address." };
    }
    const host = target.hostname.toLowerCase();
    if (host === "localhost" || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || host.endsWith(".internal")) {
      return { error: "That address isn't allowed." };
    }
    const { crawl } = await import("./provisioning.server");
    const page = await crawl(target.toString());
    if (!page.ok || !page.text) return { error: "Couldn't read that page. Check the address or paste the text instead." };
    return { title: page.title, url: page.url, text: page.text };
  });
