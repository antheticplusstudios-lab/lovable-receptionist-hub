/**
 * Automation health probes. Every check reads real runtime signals; nothing is a stored label.
 * Results: automation_health_checks (history), automation_health_state (per-check rollup),
 * automation_health (overall). Called from admin "Run diagnostics" and the cron hook.
 */
type Admin = { from: (t: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any };
type Status = "ok" | "warn" | "fail" | "skip";
type Result = { check_type: string; status: Status; latency_ms?: number; error?: string; metadata?: Record<string, unknown> };
export type Overall = "HEALTHY" | "DEGRADED" | "WARNING" | "ERROR" | "OFFLINE" | "SUSPENDED";

const CRITICAL = new Set(["database", "api_runtime", "ai_provider"]);

async function timed<T>(fn: () => Promise<T>) {
  const t0 = Date.now();
  const v = await fn();
  return { v, ms: Date.now() - t0 };
}

export async function probeAutomation(admin: Admin, id: string, appOrigin: string) {
  const results: Result[] = [];

  // Database
  const db = await timed(() => admin.from("client_automations").select("*").eq("id", id).maybeSingle());
  const a = db.v.data as any;
  results.push({ check_type: "database", status: db.v.error ? "fail" : "ok", latency_ms: db.ms, error: db.v.error?.message });
  if (!a) return { overall: "ERROR" as Overall, results };

  const runtime = String((await admin.rpc("automation_runtime_state", { _id: id })).data ?? "error");
  const since24 = new Date(Date.now() - 86_400_000).toISOString();

  // API runtime: call the real public config endpoint as the client's site would
  try {
    const r = await timed(() =>
      fetch(`${appOrigin}/api/public/widget/config?token=${a.script_token}`, { headers: { Origin: appOrigin }, signal: AbortSignal.timeout(8000) }),
    );
    const ok = r.v.status === 200 || (runtime !== "active" && r.v.status === 403);
    results.push({ check_type: "api_runtime", status: ok ? "ok" : "fail", latency_ms: r.ms, error: ok ? undefined : `HTTP ${r.v.status}`, metadata: { http: r.v.status } });
  } catch (e) {
    results.push({ check_type: "api_runtime", status: "fail", error: String(e).slice(0, 200) });
  }

  // AI provider: real request log for this automation, else recent platform-wide
  const { data: reqs } = await admin.from("llm_requests").select("status, provider, latency_ms, error, created_at").eq("automation_id", id).gte("created_at", since24).order("created_at", { ascending: false }).limit(50);
  const rows = (reqs ?? []) as any[];
  if (rows.length) {
    const errs = rows.filter((x) => x.status === "error").length;
    const lastOk = rows.find((x) => x.status === "ok");
    const ratio = errs / rows.length;
    // Fallback success still means the visitor got an answer
    const answered = rows.some((x) => x.status === "ok");
    results.push({
      check_type: "ai_provider",
      status: !answered ? "fail" : ratio > 0.5 ? "warn" : "ok",
      latency_ms: lastOk?.latency_ms,
      error: errs ? `${errs}/${rows.length} provider attempts failed in 24h` : undefined,
      metadata: { attempts: rows.length, errors: errs, last_provider: lastOk?.provider },
    });
  } else {
    const { data: g } = await admin.from("llm_requests").select("status").gte("created_at", since24).limit(50);
    const gr = (g ?? []) as any[];
    results.push({ check_type: "ai_provider", status: gr.length === 0 ? "warn" : gr.some((x) => x.status === "ok") ? "ok" : "fail", error: gr.length ? undefined : "No AI traffic in 24h to verify providers", metadata: { platform_attempts: gr.length } });
  }

  // Widget / installation
  const seen = a.last_seen_at ? Date.now() - new Date(a.last_seen_at).getTime() : null;
  results.push({
    check_type: "installation",
    status: a.requires_reinstallation ? "warn" : !a.installed_at ? "warn" : "ok",
    error: a.requires_reinstallation ? "Reinstallation required (credentials rotated)" : !a.installed_at ? "Never loaded from the client's domain" : undefined,
    metadata: { installed_at: a.installed_at },
  });
  results.push({
    check_type: "widget",
    status: seen === null ? "warn" : seen > 7 * 86_400_000 ? "warn" : "ok",
    error: seen === null ? "Widget has never loaded" : seen > 7 * 86_400_000 ? "No widget activity in 7 days" : undefined,
    metadata: { last_seen_at: a.last_seen_at, last_seen_origin: a.last_seen_origin },
  });

  // Domain reachability
  try {
    const url = /^https?:\/\//.test(a.domain_url) ? a.domain_url : `https://${a.domain_url}`;
    const r = await timed(() => fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) }));
    results.push({ check_type: "domain", status: r.v.status < 500 ? "ok" : "fail", latency_ms: r.ms, error: r.v.status < 500 ? undefined : `HTTP ${r.v.status}`, metadata: { http: r.v.status } });
  } catch (e) {
    results.push({ check_type: "domain", status: "fail", error: `Unreachable: ${String(e).slice(0, 160)}` });
  }

  // Knowledge base
  const { count: kb } = await admin.from("kb_documents").select("id", { count: "exact", head: true }).eq("automation_id", id);
  const { data: crawl } = await admin.from("crawl_jobs").select("status").eq("automation_id", id).order("created_at", { ascending: false }).limit(1);
  results.push({ check_type: "knowledge_base", status: (kb ?? 0) > 0 ? "ok" : "warn", error: (kb ?? 0) > 0 ? undefined : "No knowledge documents", metadata: { documents: kb ?? 0, last_crawl: crawl?.[0]?.status ?? null } });
  results.push({ check_type: "rag", status: "skip", error: "Vector search is scheduled for Stage 4" });

  // Channels by product
  const { data: ints } = await admin.rpc("integration_status", { _automation_id: id });
  const integ = ((ints ?? []) as any[]).reduce((m: Record<string, string>, r: any) => ((m[r.provider] = r.status), m), {});
  const need = (k: string, providers: string[], applies: boolean): Result => {
    if (!applies) return { check_type: k, status: "skip", error: "Not used by this product" };
    const st = providers.map((p) => integ[p]).find(Boolean);
    if (!st) return { check_type: k, status: "skip", error: "Pending provider credentials" };
    return { check_type: k, status: st === "connected" ? "ok" : "fail", error: st === "connected" ? undefined : `Provider status: ${st}` };
  };
  const phoneProduct = a.automation_type === "ai_receptionist";
  const msgProduct = a.automation_type === "messaging_ai";
  results.push(need("telephony", ["twilio"], phoneProduct));
  results.push(need("messaging", ["meta", "whatsapp", "telegram"], msgProduct));
  results.push(need("calendar", ["google_calendar", "google"], phoneProduct));
  results.push({ check_type: "workflow", status: "skip", error: a.automation_type === "workflow_automation" ? "Workflow engine is scheduled for Stage 3" : "Not used by this product" });

  // Billing
  const exp = a.expires_at ? new Date(a.expires_at).getTime() - Date.now() : null;
  results.push({
    check_type: "billing",
    status: exp === null ? "warn" : exp < 0 ? "fail" : exp < 7 * 86_400_000 ? "warn" : "ok",
    error: exp === null ? "No expiration date" : exp < 0 ? "Subscription expired" : exp < 7 * 86_400_000 ? "Expires within 7 days" : undefined,
    metadata: { expires_at: a.expires_at },
  });

  // Overall from real signals
  let overall: Overall = "HEALTHY";
  if (runtime === "suspended" || runtime === "expired" || runtime === "owner_restricted") overall = "SUSPENDED";
  else if (runtime !== "active") overall = "OFFLINE";
  else if (results.some((r) => r.status === "fail" && CRITICAL.has(r.check_type))) overall = "ERROR";
  else if (results.some((r) => r.status === "fail")) overall = "DEGRADED";
  else if (results.some((r) => r.status === "warn")) overall = "WARNING";

  // Persist
  const now = new Date().toISOString();
  await admin.from("automation_health_checks").insert(results.map((r) => ({ automation_id: id, check_type: r.check_type, status: r.status, latency_ms: r.latency_ms ?? null, error: r.error ?? null, metadata: r.metadata ?? {}, checked_at: now })));
  const { data: prev } = await admin.from("automation_health_state").select("*").eq("automation_id", id);
  const prevMap = new Map(((prev ?? []) as any[]).map((p) => [p.check_type, p]));
  await admin.from("automation_health_state").upsert(
    results.map((r) => {
      const p = prevMap.get(r.check_type) as any;
      const failed = r.status === "fail";
      return {
        automation_id: id,
        check_type: r.check_type,
        status: r.status,
        latency_ms: r.latency_ms ?? null,
        last_error: r.error ?? null,
        last_checked_at: now,
        last_success_at: r.status === "ok" ? now : p?.last_success_at ?? null,
        last_failure_at: failed ? now : p?.last_failure_at ?? null,
        failure_count: failed ? (p?.failure_count ?? 0) + 1 : 0,
        recovered_at: !failed && p?.status === "fail" ? now : p?.recovered_at ?? null,
      };
    }),
  );
  const bad = results.filter((r) => r.status === "fail" || r.status === "warn").map((r) => r.check_type);
  await admin.from("automation_health").upsert({ automation_id: id, overall, summary: runtime !== "active" ? `Runtime: ${runtime}` : bad.join(", "), checked_at: now });
  return { overall, runtime, results };
}

export async function probeAll(admin: Admin, appOrigin: string) {
  const { data } = await admin.from("client_automations").select("id");
  const out: { id: string; overall: string }[] = [];
  for (const r of (data ?? []) as { id: string }[]) {
    const res = await probeAutomation(admin, r.id, appOrigin);
    out.push({ id: r.id, overall: res.overall });
  }
  return out;
}
