/**
 * One-click provisioning pipeline, run right after a payment is approved:
 * crawl the client's website -> store it as knowledge -> compile the embed script.
 * Called only after the caller's staff role has been verified.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function crawl(domain: string) {
  const url = /^https?:\/\//.test(domain) ? domain : `https://${domain}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "AntheticPlusBot/1.0" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { ok: false, url, text: "", title: "" };
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
    return { ok: true, url, title, text: htmlToText(html).slice(0, 20000) };
  } catch {
    return { ok: false, url, text: "", title: "" };
  }
}

export async function runProvisioningPipeline(admin: SupabaseClient, paymentId: string, actorId: string, origin: string) {
  const { data: pay } = await admin.from("payment_submissions").select("automation_id").eq("id", paymentId).single();
  const automationId = pay?.automation_id as string | null;
  if (!automationId) return { crawled: false, snippet: "", automationId: null as string | null, crawlUrl: "", crawlChars: 0 };

  const { data: inst } = await admin
    .from("automation_instances")
    .select("id, website_domain, client_id, script_token")
    .eq("id", automationId)
    .single();
  if (!inst) return { crawled: false, snippet: "", automationId, crawlUrl: "", crawlChars: 0 };

  const page = await crawl(inst.website_domain);
  if (page.ok && page.text) {
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(page.text))))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
    await admin.from("automation_knowledge").update({ archived: true }).eq("automation_id", automationId).eq("scope", "crawl");
    await admin.from("automation_knowledge").insert({
      automation_id: automationId,
      scope: "crawl",
      title: page.title || page.url,
      content: page.text,
      version_hash: hash,
    });
    await admin
      .from("automation_instances")
      .update({ business_context: page.text.slice(0, 4000) })
      .eq("id", automationId);
  }

  const snippet = `<script src="${origin}/api/public/widget/script?token=${inst.script_token}" data-client-id="${inst.client_id}" defer></script>`;
  await admin.from("audit_log").insert({
    actor_id: actorId,
    action: "automation_one_click_provisioned",
    target: automationId,
    details: { crawled: page.ok, url: page.url },
  });
  return { crawled: page.ok, snippet, automationId, crawlUrl: page.url, crawlChars: page.text.length };
}
