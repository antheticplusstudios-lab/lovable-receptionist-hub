# AntheticPlus v1.1 — Implementation Plan

Source of truth: AntheticPlus Master Architecture v1.1 (PDF). Gen 2 (`client_automations`, `orders`, `conversations`, `messages`, `kb_documents`, `audit_logs`, `llm_api_keys`, `usage_meters`, `integration_connections`) is canonical. Gen 1 is read-only until retirement.

## Where things stand today (from the audit)

Already real and kept: sign-in + roles, 6-step checkout, verification queue + `review_order()` approval, script-token rotation trigger, payment methods, AI key pool, diagnostics page, system settings/banner/maintenance.

Broken or Gen 1-bound: widget (`widget.js` missing, tenant lookup on `automation_instances`), chat saves to `transcripts`, price calculated in the browser, Command Center / Orders / Analytics / CRM / Knowledge pages read Gen 1 tables, no embeddings or vector search, no health system, no round-robin, no user moderation.

## Architectural conflicts to confirm before the matching stage

1. **Telephony and Meta runtimes.** You said earlier that the phone (Twilio) and WhatsApp/Messenger runtimes live in your separate FastAPI service. The PDF lists them as platform integrations. Plan: this app owns configuration, secrets, webhook receivers (signature-verified), conversation storage and health. Your FastAPI owns live audio. I will confirm with you when Stage 5 starts.
2. **Two audit tables.** Gen 1 `audit_log` and Gen 2 `audit_logs` both exist. `audit_logs` gets extended (target type, target ID, before/after, reason, IP) and becomes the only audit trail.
3. **User status.** Status goes in a new `account_restrictions` table, not on `profiles`. Profiles are self-editable, so a status field there could be changed by the user.

## Stages (each one is shipped and verified before the next starts)

### Stage 1: Gen 2 foundation (first to build)
- The widget reads `client_automations` by `script_token`. It checks the request origin against `domain_url`/`origin_domain` and the `is_active` flag. It never falls back to Gen 1.
- A real `public/widget.js` loader that draws the animated orb with states: idle, listening, thinking, speaking, message, success, handoff, error, offline. It is driven by `widget_config`, and a CSS fallback is used when canvas isn't supported.
- Chat is saved to `conversations` and `messages`. Token usage goes to `usage_meters`. The model comes from `llm-router`, and KB retrieval is plugged in once Stage 4 lands.
- Pricing moves to the server: a `place_order` database function recalculates the total from a `product_prices` table, and the browser total is ignored.
- RLS fixes: `messages` inserts go through the server only, and sensitive keys stay out of the public `system_settings`.
- Acceptance: embed the snippet on a test page. The orb loads, a message gets an AI reply, a `conversations`/`messages` row appears, and the wrong domain is refused.

### Stage 2: Admin foundation
- A new admin menu following PDF section 2, plus global search / command palette (Ctrl+K).
- Users & Clients: list and detail pages with origin badges (derived from `registered_origin_domain` plus a partner lookup) and controls to suspend, ban, mute, activate and force sign-out. Every control needs a confirmation and a reason, and writes an audit entry. Banned or suspended users are blocked in the database and in server functions.
- All Automations, Running Automations (clickable metric filters), and the Automation Control Center with the PDF's 23 tabs. It includes enable, disable, pause, stop, reinstall, rotate token, rotate HMAC, test and run diagnostics.
- Health system: `automation_health_checks` and `automation_health_events` tables, filled by real probes (widget ping, last conversation, provider errors, KB state, integration state) through the existing cron hook. The overall state is healthy, degraded, warning, error, offline or suspended.
- Script Generator at `/admin/automations/scripts`, with installation records, rotation and invalidation.
- Widget Manager: a per-automation orb editor with a live preview.

### Stage 3: AI products
- Sales Agent: lead capture from the widget into the CRM, plus handoff.
- Receptionist and Messaging AI: management pages for numbers, voice/greeting, channels, webhook state and handoff.
- Workflow Automation: `workflows`, `workflow_steps` and `workflow_runs` tables, and an execution engine for triggers, conditions, actions, retries, schedules and webhooks.

### Stage 4: RAG
- Ingestion (upload, paste, crawl), chunking, and embeddings through Lovable AI.
- A `match_documents` function with an HNSW index, priority rules, and per-client isolation.

### Stage 5: Integrations
- Provider manager showing state, health, counts, cooldown and failover.
- Signature-verified webhook receivers for Twilio, Meta and Telegram. Google Calendar sign-in. Email. Your account keys are collected at this stage.

### Stage 6: Round-robin, billing, emergency controls
- Round-robin tables for teams, members, rules and assignments. Strategies: round robin, least assigned, least active, priority, weighted and manual.
- Renewals, expiry, grace period and usage billing.
- Emergency switches, each one logged.

### Stage 7: Gen 1 retirement
- Migrate data, switch every remaining page, mark the old tables DEPRECATED, and remove the old runtime code.
- Final security scan.

## Technical notes
- All new tables get GRANTs, RLS, and `has_role`/`is_admin`-based policies. Mutations go through `createServerFn` with `requireSupabaseAuth` plus a role check, then write to `audit_logs`.
- Schema changes are additive only. Old columns and tables are commented DEPRECATED, not dropped.
- Each stage ends with Playwright checks as the test owner and a test client, plus a DB read-back.
