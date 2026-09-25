import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Daily subscription check: warns, suspends expired, stops after grace period. */
export const Route = createFileRoute("/api/public/hooks/lifecycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.rpc("run_subscription_lifecycle");
        if (error) {
          console.error("lifecycle failed", error);
          return Response.json({ ok: false }, { status: 500 });
        }
        return Response.json({ ok: true, ranAt: new Date().toISOString() });
      },
    },
  },
});
