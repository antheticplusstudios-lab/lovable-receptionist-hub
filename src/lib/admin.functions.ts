import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = { supabase: SupabaseClient; userId: string };

/** Role checks are always resolved on the server — hiding menu items is not a security control. */
async function assertStaff({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw error;
  if (!data) throw new Response("Forbidden: staff access required", { status: 403 });
}

async function assertAdmin({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("is_admin", { _user_id: userId });
  if (error) throw error;
  if (!data) throw new Response("Forbidden: owner or partner access required", { status: 403 });
}

async function assertOwner({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (error) throw error;
  if (!data) throw new Response("Forbidden: owner access required", { status: 403 });
}

export const reviewPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ paymentId: z.string().uuid(), approve: z.boolean(), reason: z.string().max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await context.supabase.rpc("review_payment", {
      _payment_id: data.paymentId,
      _approve: data.approve,
      _reason: data.reason ?? "",
    });
    if (error) throw new Error(error.message);
    if (!data.approve) return { ok: true, crawled: false, snippet: "" };
    // Approval = provision + crawl + compile script + activate + extend expiry, in one click.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runProvisioningPipeline } = await import("./provisioning.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin;
    const result = await runProvisioningPipeline(supabaseAdmin as never, data.paymentId, context.userId, origin);
    return { ok: true, ...result };
  });

export const provisionAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ automationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: clientId, error } = await context.supabase.rpc("provision_automation", {
      _automation_id: data.automationId,
    });
    if (error) throw new Error(error.message);
    const { data: rows } = await context.supabase
      .from("automation_instances")
      .select("script_token")
      .eq("id", data.automationId)
      .limit(1);
    return { clientId: clientId ?? "", scriptToken: (rows?.[0] as { script_token?: string } | undefined)?.script_token ?? "" };
  });

export const runLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).parse(input ?? {}))
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.rpc("run_subscription_lifecycle");
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/** Groq key values are never returned to the browser — only a masked hint. */
export const listGroqKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { data, error } = await context.supabase
      .from("groq_keys")
      .select(
        "id, label, key_hint, is_primary, enabled, cooldown_until, request_count, error_count, last_used_at, created_at",
      )
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createGroqKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().min(1).max(60),
        keyValue: z.string().min(8).max(200),
        isPrimary: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const hint = `${data.keyValue.slice(0, 6)}…${data.keyValue.slice(-4)}`;
    if (data.isPrimary) await context.supabase.from("groq_keys").update({ is_primary: false }).eq("is_primary", true);
    const { error } = await context.supabase.from("groq_keys").insert({
      label: data.label,
      key_value: data.keyValue,
      key_hint: hint,
      is_primary: data.isPrimary,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateGroqKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        enabled: z.boolean().optional(),
        makePrimary: z.boolean().optional(),
        clearCooldown: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    if (data.makePrimary) await context.supabase.from("groq_keys").update({ is_primary: false }).eq("is_primary", true);
    const patch: { enabled?: boolean; is_primary?: boolean; cooldown_until?: string | null } = {};
    if (typeof data.enabled === "boolean") patch.enabled = data.enabled;
    if (data.makePrimary) patch.is_primary = true;
    if (data.clearCooldown) patch.cooldown_until = null;
    if (Object.keys(patch).length) {
      const { error } = await context.supabase.from("groq_keys").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteGroqKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { error } = await context.supabase.from("groq_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public to signed-in users: returns the discount percentage for an active promo code, or null. */
export const validatePromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: percent, error } = await context.supabase.rpc("validate_promo", { _code: data.code });
    if (error) return null;
    return percent ?? null;
  });

/** Invite a staff member. Partners cannot create or remove owners. */
export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email(), role: z.enum(["partner", "verifier", "admin"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.role === "partner") await assertOwner(context);
    const { error } = await context.supabase
      .from("staff_invites")
      .insert({ email: data.email.toLowerCase(), role: data.role, invited_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["owner", "partner", "admin", "verifier", "client"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.role === "owner") throw new Error("The Owner role cannot be revoked here.");
    const { error } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
