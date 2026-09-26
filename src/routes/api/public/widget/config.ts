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
        const pick = (k: string) => c[k];
        return json(
          {
            product: inst.automation_type,
            config: {
              primaryColor: pick("primaryColor"),
              accentColor: pick("accentColor"),
              glow: pick("glow"),
              size: pick("size"),
              position: pick("position"),
              orbStyle: pick("orbStyle"),
              animationSpeed: pick("animationSpeed"),
              welcomeMessage: pick("welcomeMessage") ?? pick("greeting"),
              title: pick("title"),
              subtitle: pick("subtitle"),
              placeholder: pick("placeholder"),
              autoOpen: pick("autoOpen"),
              mobileHidden: pick("mobileHidden"),
              sound: pick("sound"),
              states: pick("states"),
            },
          },
          200,
          origin,
        );
      },
    },
  },
});
