import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = { supabase: SupabaseClient; userId: string };

async function assertAdmin({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("is_admin", { _user_id: userId });
  if (error) throw error;
  if (!data) throw new Response("Forbidden: owner or partner access required", { status: 403 });
}

async function audit(ctx: Ctx, action: string, target: string, details: Record<string, unknown> = {}) {
  const { data } = await ctx.supabase.auth.getUser();
  await ctx.supabase.from("audit_log").insert({
    actor_id: ctx.userId,
    actor_email: data.user?.email ?? "",
    action,
    target,
    details,
  } as never);
}

const dayKey = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

/** Analytics aggregates over the last N days. Owner/partner only. */
export const getAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(7).max(180) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const sb = context.supabase;
    const [inst, transcripts, payments, failovers, escalations, audits] = await Promise.all([
      sb.from("automation_instances").select("id,user_id,status,killed,conversations_count,leads_count,created_at,provisioned_at,expires_at"),
      sb.from("transcripts").select("created_at").gte("created_at", since),
      sb.from("payment_submissions").select("status,amount,submitted_at,reviewed_at").gte("submitted_at", since),
      sb.from("groq_failover_log").select("created_at,status_code").gte("created_at", since),
      sb.from("ticket_escalations").select("created_at").gte("created_at", since),
      sb.from("audit_log").select("action,created_at").gte("created_at", since),
    ]);
    for (const r of [inst, transcripts, payments, failovers, escalations, audits]) if (r.error) throw new Error(r.error.message);

    const days: string[] = [];
    for (let i = data.days - 1; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 86400000)));
    const series = Object.fromEntries(
      days.map((d) => [d, { day: d, conversations: 0, approved: 0, rejected: 0, pending: 0, failures: 0, escalations: 0 }]),
    );
    const bump = (d: string, k: Exclude<keyof (typeof series)[string], "day">) => {
      const row = series[dayKey(d)];
      if (row) row[k] = Number(row[k]) + 1;
    };
    transcripts.data!.forEach((t) => bump(t.created_at, "conversations"));
    payments.data!.forEach((p) => bump(p.submitted_at, p.status as "approved" | "rejected" | "pending"));
    failovers.data!.forEach((f) => bump(f.created_at, "failures"));
    escalations.data!.forEach((e) => bump(e.created_at, "escalations"));

    const instances = inst.data!;
    const statusCounts: Record<string, number> = {};
    instances.forEach((i) => (statusCounts[i.status] = (statusCounts[i.status] ?? 0) + 1));
    const activeClients = new Set(instances.filter((i) => i.status === "active" || i.status === "paid").map((i) => i.user_id)).size;
    const soon = Date.now() + 7 * 86400000;

    return {
      series: days.map((d) => series[d]!),
      totals: {
        conversations: instances.reduce((s, i) => s + (i.conversations_count ?? 0), 0),
        leads: instances.reduce((s, i) => s + (i.leads_count ?? 0), 0),
        activeClients,
        automations: instances.length,
        killed: instances.filter((i) => i.killed).length,
        expiringSoon: instances.filter((i) => i.expires_at && new Date(i.expires_at).getTime() < soon && i.status === "active").length,
        approved: payments.data!.filter((p) => p.status === "approved").length,
        rejected: payments.data!.filter((p) => p.status === "rejected").length,
        pending: payments.data!.filter((p) => p.status === "pending").length,
        revenue: payments.data!.filter((p) => p.status === "approved").reduce((s, p) => s + Number(p.amount ?? 0), 0),
        failures: failovers.data!.length,
        escalations: escalations.data!.length,
      },
      statusCounts,
      recentActivity: (audits.data ?? []).slice(-15).reverse(),
    };
  });

/** Catalog (All Automations) editor. */
export const saveCatalogItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
        name: z.string().min(2).max(80),
        description: z.string().max(600),
        monthly_price: z.number().min(0).max(100000),
        yearly_discount_pct: z.number().min(0).max(90),
        active: z.boolean(),
        listed: z.boolean(),
        isNew: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { isNew, ...row } = data;
    const q = isNew
      ? context.supabase.from("pricing_plans").insert(row as never)
      : context.supabase.from("pricing_plans").update(row as never).eq("slug", row.slug);
    const { error } = await q;
    if (error) throw new Error(error.message);
    await audit(context, isNew ? "catalog.created" : "catalog.updated", row.slug, { listed: row.listed, active: row.active });
    return { ok: true };
  });

/** Pause or resume every automation of a catalog item (or all). */
export const bulkKill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().nullable(), killed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("automation_instances").update({ killed: data.killed } as never);
    q = data.slug ? q.eq("automation_slug", data.slug) : q.neq("id", "00000000-0000-0000-0000-000000000000");
    const { error } = await q;
    if (error) throw new Error(error.message);
    await audit(context, data.killed ? "automations.paused" : "automations.resumed", data.slug ?? "all");
    return { ok: true };
  });

export const saveSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ key: z.enum(["banner", "maintenance", "feature_flags"]), value: z.record(z.string(), z.unknown()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("system_settings" as never)
      .upsert({ key: data.key, value: data.value, updated_at: new Date().toISOString() } as never);
    if (error) throw new Error((error as { message: string }).message);
    await audit(context, "settings.updated", data.key, data.value);
    return { ok: true };
  });
