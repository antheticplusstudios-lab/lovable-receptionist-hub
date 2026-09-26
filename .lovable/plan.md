# AntheticPlus Platform Rebuild — Plan

Full rebuild to your consolidated spec. FastAPI stays separate (you host it); this app becomes the storefront, client portal and admin panel, all on one shared database the FastAPI server also reads and writes.

## Phase 0 — Stability + diagnostics
- Pin `react`, `react-dom`, `@tanstack/react-router` to one exact compatible version each, reinstall, confirm a single React copy ships.
- New admin page **Conversation Diagnostics** (`/admin/diagnostics`): pick a saved conversation or paste one, AI explains in plain English what went wrong and recommends a fix. Results saved for later reference.

## Phase 1 — Database rebuild (spec Section 11)
- Replace the current tables with the spec's layout: profiles (with `client_id`, origin domain), payment_methods, orders, client_automations, automation_tasks, llm_api_keys, usage_meters, integration_connections, crawl_jobs, kb_documents (vector embeddings), conversations, messages.
- Add the missing `audit_logs` table the spec calls for.
- Roles kept in a separate roles table (never on profiles — prevents users promoting themselves): super_admin, partner, payment_verifier, client. `profiles.role` becomes a read-only mirror or is dropped.
- Row-level security: clients see only their own data; partners only their domain's orders/clients; verifiers only the verification queue; super_admin everything. Key pool hidden from partners.
- Triggers: script-token rotation + re-crawl job + reinstall flag + audit log when domain/webhook/hmac changes; column guard blocking clients from editing `script_token` / `client_id`.
- Seed: the 10 receptionist capabilities, 4 messaging features, default payment methods (bKash, Nagad, Bank Wire, Crypto), your owner account as super_admin.
- Existing test data is discarded; old pages rewritten against the new tables.

## Phase 2 — Checkout (Section 4)
- 6-step checkout for AI Receptionist and Messaging AI (identity, channel, features, contact/region, payment, submit with confetti) → `/dashboard/orders` showing "Pending Payment Verification".
- Payment step renders active methods and their required fields from the database.
- Admin page to manage payment methods.
- Card payments (Stripe/PayPal) left as a disabled option — no account yet.
- Storefront visibility: main site shows 2 products; partner domains up to 4.

## Phase 3 — Approval + scripts (Section 5)
- Unified `/admin/verification` queue across all domains; approve/reject with reason.
- Approve creates the live automation, generates the script token, unlocks the copyable embed snippet.
- `/admin/automations/receptionist`: assign Twilio number per client/order, plus the widget customizer (orb colors, speed, waveform, greeting, position) saved to `widget_config`.
- LLM key pool page for OpenRouter/Groq keys (super_admin only).

## Phase 4 — Client portal (Section 8)
- Overview: script snippet, phone number with Copy, usage this month.
- Inbox & CRM: conversation list + transcript + audio player + extracted lead sidebar.
- Knowledge base: "Scrape website" input (queues a crawl job for FastAPI) + drag-and-drop PDF/menu upload to file storage.
- Feature toggles for the 10 capabilities (live).
- Widget customizer with live preview.
- Integrations page: buttons pointing to your FastAPI OAuth endpoints (Google Calendar, Meta, WhatsApp).

## Out of scope for this pass
- FastAPI endpoints, Twilio/Meta/Telegram webhooks, the model fallback router, `widget.js` itself — these live on your FastAPI server. This app stores the keys, config and data they need.
- Admin health pages for workflows / sales agent / messaging AI (Section 9) and checkout for Workflow Automation / AI Sales Agent (not yet spec'd).
- Previously listed Master Admin items (two-step sign-in, IP limits, broadcasts, etc.) — next pass.

## Technical details
- Migrations via the database migration tool; every new table gets GRANTs then RLS; `has_role` security-definer helper reused for policies.
- pgvector enabled; embeddings column `vector(1536)` written by FastAPI.
- Diagnostics uses the AI Gateway (`openai/gpt-6-astra`, Responses API, streamed) in a server function gated to staff.
- Storage bucket `kb-uploads` (private, per-client folder policies).
- Route param standardized to `client_id` for `/admin/clients/$clientId`.
- Script-change trigger writes to `audit_logs(automation_id, event_type, changed_fields, actor, created_at)`.
- FastAPI connects with the service-role access you already control; I'll document the table contract in `AGENTS.md`.
