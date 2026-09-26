import { createFileRoute } from "@tanstack/react-router";
import { adminClient, fail, json, originAllowed, preflight, resolveInstallation, widgetEnabledGlobally } from "@/lib/widget.server";

export const Route = createFileRoute("/api/public/widget/config")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request.headers.get("origin")),
      GET: async ({ request }) => {
        const origin = request.headers.get("origin");
        const token = new URL(request.url).searchParams.get("token") ?? "";
        let admin;
        try {
          admin = adminClient();
        } catch {
          return fail("Assistant unavailable", 503, origin, "offline");
        }
        if (!(await widgetEnabledGlobally(admin))) return fail("Assistant is offline", 503, origin, "offline");
        const inst = await resolveInstallation(admin, token);
        if (!inst) return fail("Unknown installation", 404, origin, "invalid_token");
        if (!originAllowed(inst, origin, new URL(request.url).host)) return fail("Domain not authorised", 403, origin, "domain");
        if (!inst.is_active) return fail("This assistant is not active", 403, origin, "inactive");
        await admin.from("client_automations").update({ last_seen_at: new Date().toISOString(), last_seen_origin: origin ?? "" }).eq("id", inst.id);
        const c = inst.widget_config ?? {};
        // Only presentation settings leave the server.
        const ALLOWED = ["primary","secondary","accent","glow","size","position","style","speed","amplitude","waveforms","text","title","subtitle","placeholder","autoOpen","mobileHidden","sound","states"];
        const config: Record<string, unknown> = {};
        for (const k of ALLOWED) if (c[k] !== undefined) config[k] = c[k];
        return json(
          { product: inst.automation_type, config },
          200,
          origin,
        );
      },
    },
  },
});
