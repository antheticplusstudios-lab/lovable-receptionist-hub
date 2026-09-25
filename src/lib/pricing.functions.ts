import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type LivePlan = {
  slug: string;
  monthly_price: number;
  yearly_discount_pct: number;
  active: boolean;
  listed?: boolean;
};

/**
 * Public price feed for server rendering. Both storefronts and checkout read the
 * price matrix from the database so a change in the Pricing Configurator is live
 * without redeploying.
 */
export const getLivePricing = createServerFn({ method: "GET" }).handler(async (): Promise<LivePlan[]> => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    // Opaque sb_ keys are not JWTs; send only apikey, never the default Authorization bearer.
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const { data, error } = await supabasePublic
    .from("pricing_plans")
    .select("slug, monthly_price, yearly_discount_pct, active, listed")
    .eq("active", true);
  if (error) throw new Error(error.message);
  return (data ?? []) as LivePlan[];
});
