/**
 * Production widget.js source (Gen 2). Served at /widget.js.
 * Reads data-token from its own <script> tag, loads config from /api/public/widget/config,
 * renders an animated canvas orb with runtime states, and chats via /api/public/widget/chat.
 * States: idle, listening, thinking, speaking, message, success, handoff, error, offline.
 */
export function widgetSource(apiBase: string, fallbackToken = "") {
  return `/* AntheticPlus widget v2 */
(function(){
  if (window.__antheticPlusWidget) return; window.__antheticPlusWidget = true;
  var API = ${JSON.stringify(apiBase)} + "/api/public/widget";
  var me = document.currentScript || document.querySelector('script[data-token][src*="widget"]');
  var TOKEN = (me && me.getAttribute("data-token")) || ${JSON.stringify(fallbackToken)};
  if (!TOKEN) { console.warn("[AntheticPlus] missing data-token"); return; }
  var SK = "ap_sess_" + TOKEN.slice(0,8), sess;
  try { sess = localStorage.getItem(SK); } catch(e) {}
  if (!sess) { sess = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-zA-Z0-9-]/g,""); try { localStorage.setItem(SK, sess); } catch(e) {} }

  var C = { primary:"#7c5cff", secondary:"#22d3ee", accent:"#f472b6", glow:0.8, size:64, position:"bottom-right", speed:1, amplitude:1,
            title:"AI Assistant", subtitle:"Usually replies instantly", placeholder:"Type your message…", text:"Hi! How can I help you today?",
            autoOpen:false, mobileHidden:false, sound:false, states:{} };
  var STATE_COLORS = { idle:null, listening:"#22d3ee", thinking:"#a78bfa", speaking:null, message:null, success:"#22c55e", handoff:"#f59e0b", error:"#ef4444", offline:"#6b7280" };
  var state = "idle", open = false, busy = false, root, canvas, ctx, panel, log, input, send, statusEl;

  function setState(s){ state = s; if (root) root.setAttribute("data-state", s); if (statusEl) statusEl.textContent = LABEL[s] || ""; }
  var LABEL = { idle:"Online", listening:"Listening…", thinking:"Thinking…", speaking:"Replying…", message:"New message", success:"Done", handoff:"Connecting you to a person", error:"Something went wrong", offline:"Offline" };

  function css(){
    var pos = C.position === "bottom-left" ? "left:20px" : "right:20px";
    var s = document.createElement("style");
    s.textContent = [
      ".ap-root{position:fixed;bottom:20px;"+pos+";z-index:2147483000;font-family:system-ui,-apple-system,Segoe UI,sans-serif}",
      ".ap-orb{width:"+C.size+"px;height:"+C.size+"px;border-radius:50%;border:0;padding:0;background:transparent;cursor:pointer;display:block;position:relative}",
      ".ap-orb canvas{width:100%;height:100%;display:block;border-radius:50%}",
      ".ap-fallback{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 30%,"+C.secondary+","+C.primary+" 60%,"+C.accent+");animation:ap-pulse 2.4s ease-in-out infinite}",
      "@keyframes ap-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}",
      ".ap-panel{position:absolute;bottom:"+(C.size+14)+"px;"+(C.position==="bottom-left"?"left:0":"right:0")+";width:350px;max-width:calc(100vw - 32px);height:500px;max-height:72vh;background:#0f0d1a;color:#f4f2ff;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 30px 70px rgba(0,0,0,.45);opacity:0;transform:translateY(12px) scale(.97);pointer-events:none;transition:all .28s cubic-bezier(.22,1,.36,1)}",
      ".ap-root.ap-open .ap-panel{opacity:1;transform:none;pointer-events:auto}",
      ".ap-head{padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)}.ap-head b{font-size:15px;display:block}.ap-head span{font-size:12px;opacity:.7}",
      ".ap-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}",
      ".ap-m{max-width:84%;padding:9px 13px;border-radius:14px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}",
      ".ap-u{align-self:flex-end;background:"+C.primary+";color:#fff;border-bottom-right-radius:4px}",
      ".ap-a{align-self:flex-start;background:rgba(255,255,255,.07);border-bottom-left-radius:4px}",
      ".ap-e{align-self:center;font-size:12px;color:#fca5a5}",
      ".ap-f{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.08)}",
      ".ap-i{flex:1;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 12px;font:inherit;font-size:13.5px;outline:none}",
      ".ap-s{border:0;border-radius:10px;background:"+C.primary+";color:#fff;padding:0 16px;font-weight:600;cursor:pointer}.ap-s:disabled{opacity:.5}",
      (C.mobileHidden ? "@media(max-width:640px){.ap-root{display:none}}" : "")
    ].join("\\n");
    document.head.appendChild(s);
  }

  function build(){
    root = document.createElement("div"); root.className = "ap-root";
    root.innerHTML = '<div class="ap-panel" role="dialog" aria-label="AI assistant"><div class="ap-head"><b></b><span></span></div><div class="ap-log" aria-live="polite"></div><form class="ap-f"><input class="ap-i" autocomplete="off" maxlength="2000"/><button class="ap-s" type="submit">Send</button></form></div><button class="ap-orb" aria-label="Open chat"><canvas></canvas></button>';
    document.body.appendChild(root);
    panel = root.querySelector(".ap-panel"); log = root.querySelector(".ap-log");
    input = root.querySelector(".ap-i"); send = root.querySelector(".ap-s");
    root.querySelector(".ap-head b").textContent = C.title;
    statusEl = root.querySelector(".ap-head span");
    input.placeholder = C.placeholder;
    canvas = root.querySelector("canvas"); ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) { canvas.remove(); var fb = document.createElement("span"); fb.className = "ap-fallback"; root.querySelector(".ap-orb").appendChild(fb); }
    else { var d = window.devicePixelRatio || 1; canvas.width = C.size*d; canvas.height = C.size*d; requestAnimationFrame(draw); }
    root.querySelector(".ap-orb").onclick = toggle;
    input.addEventListener("focus", function(){ if (!busy && state!=="offline") setState("listening"); });
    input.addEventListener("blur", function(){ if (state==="listening") setState("idle"); });
    root.querySelector("form").onsubmit = function(e){ e.preventDefault(); submit(); };
    setState(state);
  }

  function hex(h){ h=h.replace("#",""); if(h.length===3)h=h.split("").map(function(x){return x+x}).join(""); var n=parseInt(h,16); return [n>>16&255,n>>8&255,n&255]; }
  function rgba(h,a){ var c=hex(h); return "rgba("+c[0]+","+c[1]+","+c[2]+","+a+")"; }
  var t0 = performance.now();
  function draw(now){
    var W = canvas.width, R = W/2, t = (now - t0)/1000 * (C.speed||1);
    var sc = (C.states && C.states[state]) || {};
    var base = sc.color || STATE_COLORS[state] || C.primary;
    var energy = { idle:.25, listening:.6, thinking:.8, speaking:1, message:.7, success:.5, handoff:.5, error:.9, offline:0 }[state] || .3;
    energy *= (C.amplitude||1);
    ctx.clearRect(0,0,W,W);
    var g = ctx.createRadialGradient(R*.7,R*.6,R*.1,R,R,R);
    g.addColorStop(0, rgba(C.secondary, state==="offline"?.3:1));
    g.addColorStop(.55, rgba(base, 1));
    g.addColorStop(1, rgba(C.accent, .9));
    ctx.save(); ctx.beginPath();
    var pts = 64;
    for (var i=0;i<=pts;i++){
      var a = i/pts*Math.PI*2;
      var wob = Math.sin(a*3 + t*2.2)*.04 + Math.sin(a*5 - t*3.1)*.03;
      if (state==="thinking") wob += Math.sin(a*8 + t*6)*.025;
      if (state==="speaking") wob += Math.sin(t*14)*.03*Math.sin(a*2+t);
      var r = R*(.82 + wob*energy + Math.sin(t*1.6)*.02);
      var x = R + Math.cos(a)*r, y = R + Math.sin(a)*r;
      i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
    }
    ctx.closePath();
    ctx.shadowColor = rgba(base, Math.min(1,(C.glow||.8)));
    ctx.shadowBlur = R*.35*(state==="offline"?0:1);
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(R*.72,R*.62,R*.18,0,Math.PI*2); ctx.fillStyle="rgba(255,255,255,.28)"; ctx.fill();
    if (state==="thinking"){ for (var k=0;k<3;k++){ var aa=t*3+k*2.1; ctx.beginPath(); ctx.arc(R+Math.cos(aa)*R*.5, R+Math.sin(aa)*R*.5, R*.06,0,Math.PI*2); ctx.fillStyle="rgba(255,255,255,.8)"; ctx.fill(); } }
    requestAnimationFrame(draw);
  }

  function add(cls, text){ var el=document.createElement("div"); el.className="ap-m "+cls; el.textContent=text; log.appendChild(el); log.scrollTop=log.scrollHeight; return el; }
  function toggle(){ open=!open; root.classList.toggle("ap-open",open); if(open){ if(!log.childNodes.length && C.text) add("ap-a", C.text); setTimeout(function(){input.focus()},200);} }

  function submit(){
    var text = input.value.trim(); if (!text || busy || state==="offline") return;
    input.value = ""; add("ap-u", text); busy = true; send.disabled = true; setState("thinking");
    fetch(API + "/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ token:TOKEN, message:text, sessionId:sess }) })
      .then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
      .then(function(res){
        if (!res.ok) { setState(res.j.code==="offline"||res.j.code==="inactive" ? "offline" : "error"); add("ap-e", res.j.error || "Unable to reply"); return; }
        setState("speaking"); add("ap-a", res.j.reply);
        setTimeout(function(){ if(state==="speaking") setState(open?"idle":"message"); }, 1400);
      })
      .catch(function(){ setState("error"); add("ap-e", "Connection problem. Please try again."); })
      .then(function(){ busy=false; send.disabled=false; });
  }

  function start(){
    fetch(API + "/config?token=" + encodeURIComponent(TOKEN))
      .then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
      .then(function(res){
        if (!res.ok) { console.warn("[AntheticPlus] " + (res.j && res.j.error)); if (res.j && (res.j.code==="invalid_token"||res.j.code==="domain")) return; state="offline"; }
        else { var c=res.j.config||{}; for (var k in c) if (c[k]!==undefined && c[k]!==null && c[k]!=="") C[k]=c[k]; C.size = Math.max(44, Math.min(120, Number(C.size)||64)); }
        css(); build(); if (C.autoOpen) toggle();
      })
      .catch(function(){ state="offline"; css(); build(); });
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();`;
}
