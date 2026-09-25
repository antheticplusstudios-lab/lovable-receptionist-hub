import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type StatusReport = {
  checkedAt: string;
  database: { ok: boolean; latencyMs: number };
  api: { ok: boolean; latencyMs: number };
  inference: { ok: boolean };
};

export const getSystemStatus = createServerFn({ method: "GET" }).handler(async (): Promise<StatusReport> => {
  const started = Date.now();
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  let dbOk = false;
  let dbLatency = 0;

  if (url && key) {
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const t = Date.now();
    const { error } = await client.from("pricing_plans").select("slug").limit(1);
    dbLatency = Date.now() - t;
    dbOk = !error;
  }

  return {
    checkedAt: new Date().toISOString(),
    database: { ok: dbOk, latencyMs: dbLatency },
    api: { ok: true, latencyMs: Date.now() - started },
    inference: { ok: Boolean(process.env["LOVABLE_API_KEY"]) },
  };
});
