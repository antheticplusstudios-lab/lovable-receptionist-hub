import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/rbac.server";

/**
 * Admin Command Center server API (Gen 2 only).
 * Every function re-checks the caller's role server-side; mutations run through
 * SECURITY DEFINER RPCs that re-authorize, enforce partner scope and write audit_logs.
 */

type Row = Record<string, any>;

function originLabel(domain: string, partners: Map<string, string>) {
  const d = (domain ?? "").trim().toLowerCase();
  if (!d) return { kind: "direct", label: "DIRECT" };
  const p = partners.get(d);
  if (p) return { kind: "partner", label: `PARTNER: ${p}`, domain: d };
  return { kind: "other", label: `OTHER: ${d}`, domain: d };
}

async function partnerMap(admin: any) {
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "partner");
  const ids = ((roles ?? []) as Row[]).map((r) => r.user_id);
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data: profs } = await admin.from("profiles").select("user_id, company_name, full_name, registered_origin_domain").in("user_id", ids);
  for (const p of (profs ?? []) as Row[]) if (p.registered_origin_domain) map.set(String(p.registered_origin_domain).toLowerCase(), p.company_name || p.full_name || p.registered_origin_domain);
  return map;
}

async function scope(context: { supabase: any; userId: string }) {
  await assertAdmin(context);
  const { data: isOwner } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "owner" });
  const { data: myDomain } = await context.supabase.rpc("my_origin_domain");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { admin: supabaseAdmin as any, isOwner: !!isOwner, myDomain: String(myDomain ?? "") };
}

// ---------------- Users ----------------

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, isOwner, myDomain } = await scope(context);
    const [authUsers, profiles, roles, restr, autos, partners] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("profiles").select("*"),
      admin.from("user_roles").select("user_id, role"),
      admin.from("account_restrictions").select("*"),
      admin.from("client_automations").select("client_id, is_active, run_state, expires_at"),
      partnerMap(admin),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const r of (roles.data ?? []) as Row[]) roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
    const rMap = new Map(((restr.data ?? []) as Row[]).map((r) => [r.user_id, r]));
    const pMap = new Map(((profiles.data ?? []) as Row[]).map((p) => [p.user_id, p]));
    const aByClient = new Map<string, Row[]>();
    for (const a of (autos.data ?? []) as Row[]) aByClient.set(a.client_id, [...(aByClient.get(a.client_id) ?? []), a]);
    const users = ((authUsers.data?.users ?? []) as Row[])
      .map((u) => {
        const p = pMap.get(u.id) ?? {};
        const r = rMap.get(u.id);
        const list = aByClient.get(p.client_id) ?? [];
        const active = list.filter((a) => a.run_state === "active" && a.is_active);
        const nextExp = list.map((a) => a.expires_at).filter(Boolean).sort()[0] ?? null;
        const expired = list.some((a) => a.expires_at && new Date(a.expires_at) < new Date());
        return {
          id: u.id as string,
          email: (u.email ?? "") as string,
          name: (p.full_name || u.user_metadata?.full_name || "") as string,
          company: (p.company_name ?? "") as string,
          clientId: (p.client_id ?? "") as string,
          roles: roleMap.get(u.id) ?? [],
          status: (r?.status ?? "active") as string,
          muted: !!r?.muted,
          restrictionReason: (r?.reason ?? null) as string | null,
          originDomain: (p.registered_origin_domain ?? "") as string,
          origin: originLabel(p.registered_origin_domain ?? "", partners),
          createdAt: u.created_at as string,
          lastActivity: (u.last_sign_in_at ?? null) as string | null,
          emailConfirmed: !!u.email_confirmed_at,
          automations: list.length,
          activeAutomations: active.length,
          subscription: list.length === 0 ? "none" : expired ? "expired" : active.length ? "active" : "inactive",
          nextExpiration: nextExp as string | null,
        };
      })
      .filter((u) => isOwner || u.originDomain === myDomain);
    return { users };
  });

export const getUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, isOwner, myDomain } = await scope(context);
    const { data: au } = await admin.auth.admin.getUserById(data.userId);
    if (!au?.user) throw new Error("User not found");
    const { data: p } = await admin.from("profiles").select("*").eq("user_id", data.userId).maybeSingle();
    if (!isOwner && (p?.registered_origin_domain ?? "") !== myDomain) throw new Error("Outside your partner scope");
    const cid = p?.client_id ?? "__none__";
    const partners = await partnerMap(admin);
    const [roles, restr, orders, autos, audit] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", data.userId),
      admin.from("account_restrictions").select("*").eq("user_id", data.userId).maybeSingle(),
      admin.from("orders").select("id, order_id, automation_type, total_amount, status, rejection_reason, created_at, reviewed_at, payment_methods(method_name)").eq("client_id", cid).order("created_at", { ascending: false }),
      admin.from("client_automations").select("id, automation_type, domain_url, run_state, is_active, expires_at, created_at, last_seen_at, requires_reinstallation").eq("client_id", cid),
      admin.from("audit_logs").select("*").or(`target_id.eq.${data.userId},client_id.eq.${cid}`).order("created_at", { ascending: false }).limit(100),
    ]);
    const autoIds = ((autos.data ?? []) as Row[]).map((a) => a.id);
    const [usage, convs, kb, ints, health] = autoIds.length
      ? await Promise.all([
          admin.from("usage_meters").select("*").in("automation_id", autoIds),
          admin.from("conversations").select("id, automation_id, channel, status, created_at, last_message_at").in("automation_id", autoIds).order("last_message_at", { ascending: false }).limit(50),
          admin.from("kb_documents").select("id, automation_id, source_type, source_name, created_at").in("automation_id", autoIds),
          admin.from("integration_connections").select("automation_id, provider, status, updated_at").in("automation_id", autoIds),
          admin.from("automation_health").select("*").in("automation_id", autoIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];
    const u = au.user as Row;
    return {
      user: {
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at ?? null,
        emailConfirmed: !!u.email_confirmed_at,
        provider: u.app_metadata?.provider ?? "email",
        bannedUntil: u.banned_until ?? null,
      },
      profile: p,
      origin: originLabel(p?.registered_origin_domain ?? "", partners),
      roles: ((roles.data ?? []) as Row[]).map((r) => r.role as string),
      restriction: restr.data ?? null,
      orders: orders.data ?? [],
      automations: autos.data ?? [],
      usage: usage.data ?? [],
      conversations: convs.data ?? [],
      knowledge: kb.data ?? [],
      integrations: ints.data ?? [],
      health: health.data ?? [],
      audit: audit.data ?? [],
    };
  });

const ModAction = z.enum(["suspend", "unsuspend", "ban", "unban", "mute", "unmute", "activate", "deactivate", "force_signout"]);

export const moderateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), action: ModAction, reason: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Authorization, partner scope, DB state and audit happen inside the RPC as the caller.
    const { data: after, error } = await context.supabase.rpc("admin_moderate_user", { _user: data.userId, _action: data.action, _reason: data.reason });
    if (error) throw new Error(error.message);
    // Mirror to the auth service so blocked users cannot obtain new sessions.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const status = (after as Row)?.status as string;
    const ban = status === "active" ? "none" : "876000h";
    const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: ban } as never);
    return { ok: true, status, muted: (after as Row)?.muted, authSync: aErr ? aErr.message : "ok" };
  });

// ---------------- Automations ----------------

export const listAutomations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, isOwner, myDomain } = await scope(context);
    let q = admin.from("client_automations").select("*").order("created_at", { ascending: false });
    if (!isOwner) q = q.eq("origin_domain", myDomain);
    const { data: autos, error } = await q;
    if (error) throw new Error(error.message);
    const list = (autos ?? []) as Row[];
    const ids = list.map((a) => a.id);
    const cids = [...new Set(list.map((a) => a.client_id))];
    const period = new Date().toISOString().slice(0, 7);
    const [profiles, health, usage, convs, ints, llmErr, runtime, partners] = await Promise.all([
      cids.length ? admin.from("profiles").select("client_id, user_id, full_name, company_name, registered_origin_domain").in("client_id", cids) : { data: [] },
      ids.length ? admin.from("automation_health").select("*").in("automation_id", ids) : { data: [] },
      ids.length ? admin.from("usage_meters").select("automation_id, tokens_used, call_minutes_used, sms_count_used").eq("billing_period", period).in("automation_id", ids) : { data: [] },
      ids.length ? admin.from("conversations").select("automation_id, channel, last_message_at").in("automation_id", ids).order("last_message_at", { ascending: false }).limit(2000) : { data: [] },
      ids.length ? admin.from("integration_connections").select("automation_id, provider, status").in("automation_id", ids) : { data: [] },
      ids.length ? admin.from("llm_requests").select("automation_id").eq("status", "error").gte("created_at", new Date(Date.now() - 86_400_000).toISOString()).in("automation_id", ids) : { data: [] },
      Promise.all(ids.map(async (id) => [id, String((await admin.rpc("automation_runtime_state", { _id: id })).data ?? "")] as const)),
      partnerMap(admin),
    ]);
    const pMap = new Map(((profiles.data ?? []) as Row[]).map((p) => [p.client_id, p]));
    const hMap = new Map(((health.data ?? []) as Row[]).map((h) => [h.automation_id, h]));
    const uMap = new Map(((usage.data ?? []) as Row[]).map((u) => [u.automation_id, u]));
    const rtMap = new Map(runtime);
    const last = new Map<string, string>();
    const channels = new Map<string, Set<string>>();
    for (const c of (convs.data ?? []) as Row[]) {
      if (!last.has(c.automation_id)) last.set(c.automation_id, c.last_message_at);
      channels.set(c.automation_id, (channels.get(c.automation_id) ?? new Set()).add(c.channel));
    }
    const intFail = new Set(((ints.data ?? []) as Row[]).filter((i) => i.status !== "connected").map((i) => i.automation_id));
    const provFail = new Map<string, number>();
    for (const r of (llmErr.data ?? []) as Row[]) provFail.set(r.automation_id, (provFail.get(r.automation_id) ?? 0) + 1);
    return {
      automations: list.map((a) => {
        const p = pMap.get(a.client_id) ?? {};
        const h = hMap.get(a.id);
        const exp = a.expires_at ? Math.ceil((new Date(a.expires_at).getTime() - Date.now()) / 86_400_000) : null;
        return {
          id: a.id as string,
          clientId: a.client_id as string,
          ownerUserId: (p.user_id ?? null) as string | null,
          clientName: (p.full_name ?? "") as string,
          company: (p.company_name ?? "") as string,
          type: a.automation_type as string,
          orderId: a.order_id as string | null,
          domain: a.domain_url as string,
          runState: a.run_state as string,
          runtime: rtMap.get(a.id) ?? "",
          isActive: !!a.is_active,
          health: (h?.overall ?? "UNCHECKED") as string,
          healthSummary: (h?.summary ?? "") as string,
          healthCheckedAt: (h?.checked_at ?? null) as string | null,
          createdAt: a.created_at as string,
          expiresAt: a.expires_at as string | null,
          renewalAt: a.expires_at as string | null,
          daysRemaining: exp,
          tokens: Number(uMap.get(a.id)?.tokens_used ?? 0),
          channels: [...(channels.get(a.id) ?? [])],
          phone: (a.assigned_phone_number ?? null) as string | null,
          lastActivity: last.get(a.id) ?? a.last_seen_at ?? null,
          installed: !!a.installed_at,
          requiresReinstallation: !!a.requires_reinstallation,
          origin: originLabel(a.origin_domain || p.registered_origin_domain || "", partners),
          integrationFailure: intFail.has(a.id),
          providerFailures: provFail.get(a.id) ?? 0,
        };
      }),
    };
  });

export const getAutomationDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await scope(context);
    const { data: can } = await context.supabase.rpc("can_manage_client_automation", { _id: data.id });
    if (!can) throw new Error("Not authorized for this automation");
    const { data: a } = await admin.from("client_automations").select("*").eq("id", data.id).maybeSingle();
    if (!a) throw new Error("Automation not found");
    const partners = await partnerMap(admin);
    const [profile, order, tasks, kb, crawls, convs, usage, ints, health, checks, state, llm, audit, scripts, runtime] = await Promise.all([
      admin.from("profiles").select("*").eq("client_id", a.client_id).maybeSingle(),
      a.order_id ? admin.from("orders").select("*, payment_methods(method_name)").eq("order_id", a.order_id).maybeSingle() : { data: null },
      admin.from("automation_tasks").select("*").eq("automation_id", a.id),
      admin.from("kb_documents").select("id, source_type, source_name, priority, created_at").eq("automation_id", a.id),
      admin.from("crawl_jobs").select("*").eq("automation_id", a.id).order("created_at", { ascending: false }).limit(20),
      admin.from("conversations").select("id, channel, status, customer_phone_or_id, origin, created_at, last_message_at, extracted_lead_data").eq("automation_id", a.id).order("last_message_at", { ascending: false }).limit(50),
      admin.from("usage_meters").select("*").eq("automation_id", a.id).order("billing_period", { ascending: false }),
      admin.from("integration_connections").select("provider, status, updated_at").eq("automation_id", a.id),
      admin.from("automation_health").select("*").eq("automation_id", a.id).maybeSingle(),
      admin.from("automation_health_checks").select("*").eq("automation_id", a.id).order("checked_at", { ascending: false }).limit(120),
      admin.from("automation_health_state").select("*").eq("automation_id", a.id),
      admin.from("llm_requests").select("id, provider, model, status, http_status, latency_ms, tokens_in, tokens_out, error, created_at").eq("automation_id", a.id).order("created_at", { ascending: false }).limit(50),
      admin.from("audit_logs").select("*").eq("automation_id", a.id).order("created_at", { ascending: false }).limit(100),
      admin.from("script_generations").select("*").eq("automation_id", a.id).order("created_at", { ascending: false }).limit(20),
      admin.rpc("automation_runtime_state", { _id: a.id }),
    ]);
    const { hmac_key, script_token, ...safe } = a as Row;
    const leads = ((convs.data ?? []) as Row[]).filter((c) => c.extracted_lead_data && Object.keys(c.extracted_lead_data).length);
    return {
      automation: { ...safe, token_hint: String(script_token).slice(-6), hmac_set: !!hmac_key },
      runtime: String(runtime.data ?? ""),
      profile: profile.data,
      origin: originLabel(a.origin_domain || profile.data?.registered_origin_domain || "", partners),
      order: order.data,
      tasks: tasks.data ?? [],
      knowledge: kb.data ?? [],
      crawls: crawls.data ?? [],
      conversations: convs.data ?? [],
      leads,
      usage: usage.data ?? [],
      integrations: ints.data ?? [],
      health: health.data,
      checks: checks.data ?? [],
      healthState: state.data ?? [],
      llm: llm.data ?? [],
      audit: audit.data ?? [],
      scripts: scripts.data ?? [],
    };
  });

export const getConversationMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase.from("messages").select("id, role, content, tokens_used, created_at").eq("conversation_id", data.conversationId).order("created_at");
    if (error) throw new Error(error.message);
    return { messages: rows ?? [] };
  });

const AutoAction = z.enum(["enable", "disable", "pause", "resume", "stop", "reinstall", "rotate_token", "rotate_hmac"]);

export const automationAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), action: AutoAction, reason: z.string().trim().max(500).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: after, error } = await context.supabase.rpc("admin_automation_action", { _id: data.id, _action: data.action, _reason: data.reason });
    if (error) throw new Error(error.message);
    return { ok: true, after };
  });

export const runDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await scope(context);
    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = (process.env["VITE_APP_URL"] ?? "").replace(/\/$/, "") || new URL(getRequest().url).origin;
    const { probeAutomation, probeAll } = await import("@/lib/health.server");
    if (data.id) {
      const { data: can } = await context.supabase.rpc("can_manage_client_automation", { _id: data.id });
      if (!can) throw new Error("Not authorized for this automation");
      const r = await probeAutomation(admin, data.id, origin);
      await admin.from("audit_logs").insert({ automation_id: data.id, event_type: "automation.diagnostics", actor: context.userId, target_type: "automation", target_id: data.id, changed_fields: { overall: r.overall } });
      return { overall: r.overall, checks: r.results.length };
    }
    const all = await probeAll(admin, origin);
    return { overall: "batch", checks: all.length };
  });

/** Sends a real message through the production widget endpoint as the app itself. */
export const testAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), message: z.string().trim().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await scope(context);
    const { data: can } = await context.supabase.rpc("can_manage_client_automation", { _id: data.id });
    if (!can) throw new Error("Not authorized for this automation");
    const { data: a } = await admin.from("client_automations").select("script_token").eq("id", data.id).single();
    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin;
    const t0 = Date.now();
    const res = await fetch(`${origin}/api/public/widget/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ token: a.script_token, message: data.message, sessionId: `admin-test-${data.id}` }),
    });
    const body = (await res.json().catch(() => ({}))) as Row;
    await admin.from("audit_logs").insert({ automation_id: data.id, event_type: "automation.test", actor: context.userId, target_type: "automation", target_id: data.id, changed_fields: { http: res.status } });
    return { status: res.status, latencyMs: Date.now() - t0, reply: body["reply"] ?? null, error: body["error"] ?? null };
  });

export const generateScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: token, error } = await context.supabase.rpc("admin_generate_script", { _id: data.id });
    if (error) throw new Error(error.message);
    const { data: a } = await context.supabase.from("client_automations").select("client_id, order_id").eq("id", data.id).single();
    const { getRequest } = await import("@tanstack/react-start/server");
    const base = (process.env["VITE_APP_URL"] ?? "").replace(/\/$/, "") || new URL(getRequest().url).origin;
    const snippet = `<script\n  src="${base}/widget.js"\n  data-client-id="${a?.client_id ?? ""}"\n  data-order-id="${a?.order_id ?? ""}"\n  data-token="${token}"\n  async>\n</script>`;
    return { snippet };
  });

// ---------------- Widget config ----------------

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const stateCfg = z.object({ color: hex.optional(), speed: z.number().min(0).max(5).optional(), energy: z.number().min(0).max(3).optional() }).partial();
export const WidgetConfigSchema = z.object({
  primary: hex,
  secondary: hex,
  accent: hex,
  centerColor: hex,
  background: z.enum(["transparent", "dark", "light"]),
  ballCount: z.number().int().min(1).max(16),
  radius: z.number().min(0.1).max(0.6),
  ballSize: z.number().min(0.04).max(0.35),
  centerSize: z.number().min(0).max(0.5),
  tilt: z.number().min(0).max(1),
  variation: z.number().min(0).max(1),
  shine: z.number().min(0).max(1),
  speed: z.number().min(0.1).max(4),
  glow: z.number().min(0).max(1),
  size: z.number().int().min(44).max(120),
  mobileSize: z.number().int().min(40).max(100),
  position: z.enum(["bottom-right", "bottom-left"]),
  autoOpen: z.boolean(),
  mobileHidden: z.boolean(),
  sound: z.boolean(),
  title: z.string().max(60),
  subtitle: z.string().max(80),
  placeholder: z.string().max(80),
  text: z.string().max(400),
  chatTheme: z.enum(["dark", "light"]),
  behavior: z.string().max(4000).optional(),
  states: z.object({
    idle: stateCfg, listening: stateCfg, thinking: stateCfg, speaking: stateCfg, message: stateCfg,
    success: stateCfg, handoff: stateCfg, error: stateCfg, offline: stateCfg,
  }).partial(),
});

export const saveWidgetConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), config: WidgetConfigSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.rpc("admin_update_widget_config", { _id: data.id, _config: data.config as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Orders ----------------

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, isOwner, myDomain } = await scope(context);
    let q = admin.from("orders").select("*, payment_methods(method_name)").order("created_at", { ascending: false });
    if (!isOwner) q = q.eq("origin_domain", myDomain);
    const [{ data: orders }, partners, { data: autos }] = await Promise.all([q, partnerMap(admin), admin.from("client_automations").select("id, order_id")]);
    const aMap = new Map(((autos ?? []) as Row[]).map((a) => [a.order_id, a.id]));
    return {
      orders: ((orders ?? []) as Row[]).map((o) => ({ ...o, automationId: aMap.get(o.order_id) ?? null, origin: originLabel(o.origin_domain ?? "", partners) })),
    };
  });
