import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fail, isActive, json, originAllowed, preflight, resolveTenant } from "@/lib/widget.server";

export const Route = createFileRoute("/api/public/widget/config")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const admin = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const instance = await resolveTenant(admin, token);
        if (!instance) return fail("Unknown or expired widget token", 404);
        if (!originAllowed(instance, request.headers.get("origin"), new URL(request.url).host)) return fail("Origin not authorised", 403);
        if (!(await isActive(instance))) return fail("This automation is not active", 403);

        return json({
          clientId: instance.client_id,
          automation: instance.automation_slug,
          status: instance.status,
          greeting: "Hi! How can we help you today?",
          theme: { primary: "#6d4aff", surface: "#ffffff" },
          features: { scheduling: true, escalation: true, crmSync: true },
        });
      },
    },
  },
});
