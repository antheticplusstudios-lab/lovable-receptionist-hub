import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertOwner } from "./rbac.server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const KEY_SECRET = "openrouter_api_key";
const MODEL_SECRET = "assistant_model";

type Ctx = { supabase: SupabaseClient; userId: string };

async function readSecret({ supabase }: Ctx, key: string) {
  const { data, error } = await supabase.from("app_secrets").select("value").eq("key", key).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.value ?? "";
}

async function writeSecret({ supabase }: Ctx, key: string, value: string) {
  const { error } = await supabase
    .from("app_secrets")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

function mask(value: string) {
  if (value.length <= 10) return "••••";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/** Does the operator still need to paste a key? The key itself never leaves the server. */
export const assistantStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const key = await readSecret(context, KEY_SECRET);
    const model = (await readSecret(context, MODEL_SECRET)) || DEFAULT_MODEL;
    return { configured: key.length > 0, hint: key ? mask(key) : "", model };
  });

export const saveAssistantSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        keyValue: z.string().max(300).optional(),
        model: z.string().max(80).optional(),
        clearKey: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    if (data.clearKey) {
      await context.supabase.from("app_secrets").delete().eq("key", KEY_SECRET);
    } else if (data.keyValue && data.keyValue.trim().length >= 8) {
      await writeSecret(context, KEY_SECRET, data.keyValue.trim());
    }
    if (data.model && data.model.trim()) await writeSecret(context, MODEL_SECRET, data.model.trim());
    const key = await readSecret(context, KEY_SECRET);
    return { configured: key.length > 0, hint: key ? mask(key) : "" };
  });

/** Compact, token-cheap picture of the business that the model is allowed to use. */
async function snapshot(supabase: SupabaseClient) {
  const [payments, instances, profiles, usage, transcripts, plans] = await Promise.all([
    supabase
      .from("payment_submissions")
      .select("status, amount, billing_plan, payment_method, automation_slug, origin, submitted_at, sender_name")
      .order("submitted_at", { ascending: false })
      .limit(25),
    supabase
      .from("automation_instances")
      .select("status, automation_slug, website_domain, billing_plan, expires_at, killed, warning_sent, grace_days, conversations_count, leads_count, origin")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("profiles").select("company_name, website_url, category, profile_completed").limit(200),
    supabase.from("usage_logs").select("tokens_in, tokens_out, model").limit(400),
    supabase.from("transcripts").select("created_at").limit(200),
    supabase.from("pricing_plans").select("slug, monthly_price, active").eq("active", true).limit(30),
  ]);

  const rows = <T,>(result: { data: T[] | null }) => result.data ?? [];
  const paymentRows = rows(payments);
  const instanceRows = rows(instances);
  const usageRows = rows(usage);

  const now = Date.now();
  const live = instanceRows.filter(
    (row) => (row.status === "active" || row.status === "paid") && !row.killed && row.expires_at
      ? new Date(row.expires_at).getTime() > now
      : false,
  );
  const awaiting = paymentRows.filter((row) => row.status === "pending" || row.status === "pending_payment");
  const rejected = paymentRows.filter((row) => row.status === "rejected");
  const approved = paymentRows.filter((row) => row.status === "approved");
  const priceBySlug = new Map(rows(plans).map((plan) => [plan.slug, Number(plan.monthly_price)]));
  const mrr = live.reduce((sum, row) => sum + (priceBySlug.get(row.automation_slug) ?? 0), 0);
  const tokens = usageRows.reduce((sum, row) => sum + Number(row.tokens_in ?? 0) + Number(row.tokens_out ?? 0), 0);

  const money = (value: number) => `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const short = (value: string | null) => (value ? String(value).slice(0, 10) : "—");

  return [
    `TODAY: ${new Date().toISOString()}`,
    `Customers: ${rows(profiles).length}. Live automations: ${live.length}. Awaiting verification: ${awaiting.length}. Rejected: ${rejected.length}. Approved payments: ${approved.length}.`,
    `Estimated MRR from live automations: ${money(mrr)}. Model tokens logged: ${tokens.toLocaleString("en-US")}. Transcripts stored: ${rows(transcripts).length}.`,
    "",
    "LIVE AUTOMATIONS (status, plan, domain, expires, conversations, leads, origin):",
    ...instanceRows
      .slice(0, 15)
      .map(
        (row) =>
          `- ${row.automation_slug} | ${row.status}${row.killed ? " (killed)" : ""} | ${row.billing_plan} | ${row.website_domain} | ${short(row.expires_at)} | ${row.conversations_count} | ${row.leads_count} | ${row.origin ?? "—"}`,
      ),
    "",
    "RECENT PAYMENTS (status, amount, plan, method, origin, when, sender):",
    ...paymentRows
      .slice(0, 15)
      .map(
        (row) =>
          `- ${row.status} | ${money(Number(row.amount))} | ${row.billing_plan} | ${row.payment_method} | ${row.origin ?? "—"} | ${short(row.submitted_at)} | ${row.sender_name}`,
      ),
    "",
    "PRICE LIST (slug: monthly USD):",
    ...rows(plans).map((plan) => `- ${plan.slug}: ${plan.monthly_price}`),
  ].join("\n");
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ question: z.string().min(3).max(600) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const key = await readSecret(context, KEY_SECRET);
    if (!key) throw new Error("Add your OpenRouter key on the Infrastructure page first.");
    const model = (await readSecret(context, MODEL_SECRET)) || DEFAULT_MODEL;
    const context0 = await snapshot(context.supabase);

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: AbortSignal.timeout(45_000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://antheticplus.ai",
        "X-Title": "AntheticPlus Control Center",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              "You are the operations assistant inside AntheticPlus Studios' control center (an agency that sells hosted AI automations on 30-day subscriptions, verified by hand). " +
              "Answer the operator's question using ONLY the data snapshot below. Never invent names, amounts, dates or statuses. " +
              "If the snapshot cannot answer the question, say so plainly and name the page where the answer lives. " +
              "Format: 2-5 short sentences, then up to 3 bullet points of concrete next actions. Plain business language, no markdown headings.",
          },
          { role: "system", content: `DATA SNAPSHOT\n${context0}` },
          { role: "user", content: data.question },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const clean = detail.replace(/sk-or-[A-Za-z0-9-]+/g, "[redacted]").slice(0, 300);
      throw new Error(`OpenRouter responded ${response.status}. ${clean}`.trim());
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (payload.error?.message) throw new Error(payload.error.message.slice(0, 300));
    const answer = payload.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("The model returned nothing. Try again or pick another model.");

    // Usage is recorded for the audit trail, but a logging failure must not lose the answer.
    try {
      await context.supabase
        .from("audit_log")
        .insert({
          actor_id: context.userId,
          actor_email: context.claims?.email ? String(context.claims.email) : "staff",
          action: "assistant_query",
          target: model,
          details: data.question.slice(0, 200),
        });
    } catch {
      // Audit logging is best-effort; the answer has already been produced.
    }

    return { answer, model };
  });
