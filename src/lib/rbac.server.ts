import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = { supabase: SupabaseClient; userId: string };

/**
 * Role checks run on the server only. Hiding a menu item is never a security
 * control, so every privileged function re-checks the caller's role here.
 */
export async function assertStaff({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw error;
  if (!data) throw new Response("Forbidden: staff access required", { status: 403 });
}

export async function assertAdmin({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("is_admin", { _user_id: userId });
  if (error) throw error;
  if (!data) throw new Response("Forbidden: owner or partner access required", { status: 403 });
}

export async function assertOwner({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (error) throw error;
  if (!data) throw new Response("Forbidden: owner access required", { status: 403 });
}
