import { createFileRoute } from "@tanstack/react-router";
import { fail, resolveTenant } from "@/lib/widget.server";
import { createClient } from "@supabase/supabase-js";

const CACHE = "public, max-age=60";

function scriptFor(token: string, origin: string) {
  return `/* Anthetic AI — client widget. Generated snippet, do not edit. */
(function () {
  if (window.__antheticWidget) return;
  window.__antheticWidget = true;
  var API = "${origin}/api/public/widget";
  var TOKEN = ${JSON.stringify(token)};
  var S = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
  var link = document.createElement("link"); link.rel = "stylesheet"; link.href = S;
  document.head.appendChild(link);

  var css = document.createElement("style");
  css.textContent = [
    ".aw-root{position:fixed;bottom:20px;right:20px;z-index:2147483000;font-family:Inter,system-ui,sans-serif}",
    ".aw-btn{width:56px;height:56px;border-radius:999px;border:0;cursor:pointer;background:#6d4aff;color:#fff;font-size:22px;box-shadow:0 12px 30px rgba(109,74,255,.45);transition:transform .25s cubic-bezier(.22,1,.36,1),box-shadow .25s}",
    ".aw-btn:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 18px 40px rgba(109,74,255,.55)}",
    ".aw-btn.aw-open{transform:rotate(45deg)}",
    ".aw-panel{position:absolute;bottom:68px;right:0;width:340px;max-width:calc(100vw - 40px);height:480px;max-height:70vh;background:#fff;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(15,10,40,.25);opacity:0;transform:translateY(14px) scale(.97);pointer-events:none;transition:opacity .28s cubic-bezier(.22,1,.36,1),transform .28s cubic-bezier(.22,1,.36,1)}",
    ".aw-root.aw-visible .aw-panel{opacity:1;transform:none;pointer-events:auto}",
    ".aw-head{background:linear-gradient(135deg,#6d4aff,#8b5cf6);color:#fff;padding:16px;font-weight:600;font-size:15px}",
    ".aw-head span{display:block;font-weight:400;font-size:12px;opacity:.85;margin-top:2px}",
    ".aw-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#fafafa}",
    ".aw-msg{max-width:82%;padding:9px 13px;border-radius:14px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;animation:aw-pop .25s cubic-bezier(.22,1,.36,1)}",
    ".aw-msg.aw-me{align-self:flex-end;background:#6d4aff;color:#fff;border-bottom-right-radius:4px}",
    ".aw-msg.aw-ai{align-self:flex-start;background:#fff;color:#1f1a33;border:1px solid #ece7fa;border-bottom-left-radius:4px}",
    ".aw-typing{align-self:flex-start;display:flex;gap:4px;padding:11px 14px;background:#fff;border:1px solid #ece7fa;border-radius:14px}",
    ".aw-typing i{width:6px;height:6px;border-radius:50%;background:#a78bfa;animation:aw-b 1.2s infinite}",
    ".aw-typing i:nth-child(2){animation-delay:.15s}.aw-typing i:nth-child(3){animation-delay:.3s}",
    "@keyframes aw-pop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
    "@keyframes aw-b{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}",
    ".aw-form{display:flex;gap:8px;padding:12px;border-top:1px solid #ece7fa;background:#fff}",
    ".aw-input{flex:1;border:1px solid #e2dcef;border-radius:10px;padding:10px 12px;font-size:13.5px;font-family:inherit;outline:none;transition:border-color .2s}",
    ".aw-input:focus{border-color:#6d4aff}",
    ".aw-send{border:0;border-radius:10px;background:#6d4aff;color:#fff;padding:0 16px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .2s}",
    ".aw-send:disabled{opacity:.5;cursor:default}",
    "@media(max-width:420px){.aw-root{bottom:14px;right:14px}.aw-panel{width:calc(100vw - 28px);bottom:64px}}"
  ].join("\\n");
  document.head.appendChild(css);

  var root = document.createElement("div");
  root.className = "aw-root";
  root.innerHTML =
    '<button class="aw-btn" aria-label="Chat with us">💬</button>' +
    '<div class="aw-panel" role="dialog" aria-label="AI assistant">' +
      '<div class="aw-head">AI Assistant<span>We usually reply instantly</span></div>' +
      '<div class="aw-log"></div>' +
      '<form class="aw-form"><input class="aw-input" placeholder="Type your message…" autocomplete="off"/><button class="aw-send" type="submit">Send</button></form>' +
    '</div>';
  document.body.appendChild(root);

  var btn = root.querySelector(".aw-btn"), panel = root.querySelector(".aw-panel"),
      log = root.querySelector(".aw-log"), form = root.querySelector(".aw-form"),
      input = root.querySelector(".aw-input"), send = root.querySelector(".aw-send");
  var history = [], busy = false;

  function add(role, text) {
    var el = document.createElement("div");
    el.className = "aw-msg " + (role === "me" ? "aw-me" : "aw-ai");
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function toggle() {
    root.classList.toggle("aw-visible");
    btn.classList.toggle("aw-open");
    if (root.classList.contains("aw-visible") && !log.children.length) {
      fetch(API + "/config?token=" + TOKEN, { headers: { "X-Widget-Token": TOKEN } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (cfg) { add("ai", cfg && cfg.greeting ? cfg.greeting : "Hi! How can we help you today?"); })
        .catch(function () { add("ai", "Hi! How can we help you today?"); });
    }
  }

  btn.addEventListener("click", toggle);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    add("me", text);
    busy = true; send.disabled = true;
    var typing = document.createElement("div");
    typing.className = "aw-typing";
    typing.innerHTML = "<i></i><i></i><i></i>";
    log.appendChild(typing); log.scrollTop = log.scrollHeight;

    fetch(API + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Widget-Token": TOKEN },
      body: JSON.stringify({ token: TOKEN, message: text, history: history })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      typing.remove();
      if (data.error) { add("ai", data.error); }
      else {
        add("ai", data.reply);
        history.push({ role: "user", content: text }, { role: "assistant", content: data.reply });
        if (history.length > 20) history = history.slice(-20);
      }
    })
    .catch(function () { typing.remove(); add("ai", "Connection hiccup — please try again."); })
    .finally(function () { busy = false; send.disabled = false; });
  });
})();`;
}

export const Route = createFileRoute("/api/public/widget/script")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        if (!token) return fail("Missing token", 400);

        const admin = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const instance = await resolveTenant(admin, token);
        if (!instance) return fail("Unknown widget token", 404);

        const configured = (process.env["VITE_APP_URL"] ?? "").replace(/\/$/, "");
        const origin = configured || `${url.protocol}//${url.host}`;
        return new Response(scriptFor(token, origin), {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": CACHE,
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
