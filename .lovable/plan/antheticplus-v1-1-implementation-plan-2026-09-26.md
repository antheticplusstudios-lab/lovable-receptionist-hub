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
- Each stage ends with Playwright checks as the test owner and a test client, plus a DB read-back. Mandatory Implementation Requirements

These requirements are part of the AntheticPlus v1.1 implementation plan and must be treated as mandatory acceptance criteria, not optional suggestions.

&nbsp;

1. Gen 2 Is the Single Canonical Architecture

&nbsp;

- "client_automations", "orders", "conversations", "messages", "kb_documents", "audit_logs", "llm_api_keys", "usage_meters", "integration_connections" and all other approved Gen 2 structures are canonical.

- Gen 1 tables and runtime code are migration-only.

- Do not build any new functionality on Gen 1 tables.

- Do not create new parallel tables that duplicate existing Gen 2 functionality.

- Every replacement must migrate the relevant Gen 1 functionality/data into the canonical Gen 2 architecture.

- Do not leave split-brain behavior where one part of the platform uses Gen 1 and another uses Gen 2.

&nbsp;

2. Production Feature Standard

&nbsp;

A feature is NOT considered complete because its page, button, card, form, or dashboard exists.

&nbsp;

Every production feature must include, where applicable:

&nbsp;

- Frontend UI

- Database schema

- Database relationships

- RLS policies

- Server-side authorization

- Server functions/API

- Real runtime behavior

- Provider/integration connection

- Validation

- Error handling

- Loading states

- Empty states

- Retry/recovery behavior

- Usage tracking

- Health monitoring

- Logging

- Audit logging

- Admin controls

- Client controls

- Security controls

- End-to-end tests

- Database read-back verification

&nbsp;

Never use fake health data, fake integrations, placeholder runtime behavior, simulated success states, or hardcoded production data.

&nbsp;

3. FastAPI Integration Contract

&nbsp;

The FastAPI service is a real production runtime dependency for the applicable channels and must have an explicit integration contract with the AntheticPlus application.

&nbsp;

Before Stage 5 implementation, define and document:

&nbsp;

- Authentication between the systems

- Automation/client identification

- Conversation identification

- Request/response contracts

- Webhook contracts

- Signature verification

- Error responses

- Retry behavior

- Idempotency

- Timeout behavior

- Health-check endpoints

- Usage reporting

- Conversation/message persistence

- Provider failure reporting

- Audit requirements

&nbsp;

Lovable must not invent a second competing runtime architecture.

&nbsp;

The system must clearly define which responsibilities belong to Supabase/application infrastructure and which belong to FastAPI.

&nbsp;

4. LLM Router Must Be a Real Core Service

&nbsp;

The "llm-router" must not simply select one hardcoded model.

&nbsp;

It must support:

&nbsp;

- Multiple configured providers

- Provider priority

- Model selection

- Per-automation configuration

- Fallback providers

- Provider cooldown

- Error tracking

- Request tracking

- Token usage

- Latency tracking

- Failure handling

- Automatic failover

- Provider health

- Admin configuration

- Automation-level overrides where authorized

- Safe server-side secret handling

&nbsp;

The router must be the canonical path for AI requests rather than having individual features implement their own unrelated provider logic.

&nbsp;

5. Real Automation Health

&nbsp;

Automation health must represent actual runtime state.

&nbsp;

Every health check should record, where applicable:

&nbsp;

- Automation ID

- Check type

- Status

- Checked timestamp

- Response latency

- Error information

- Provider information

- Last successful check

- Last failed check

- Failure count

- Recovery timestamp

- Relevant metadata

&nbsp;

Health checks should cover applicable areas such as:

&nbsp;

- Database

- AI provider

- API/runtime

- Widget

- Domain

- Knowledge base

- RAG

- Telephony

- Messaging

- Calendar

- Workflow engine

- Billing/subscription

- Installation

&nbsp;

Overall health must be calculated from real signals.

&nbsp;

Do not display "HEALTHY" merely because an automation record exists.

&nbsp;

6. Automation Control Center Must Be Fully Functional

&nbsp;

Every automation detail page must provide the complete control center defined by the Master Architecture.

&nbsp;

It must expose the relevant:

&nbsp;

- Client

- Company

- Domain

- Product

- Status

- Health

- Subscription

- Renewal

- Expiration

- Usage

- Installation

- Script

- Widget

- AI configuration

- Prompt/behavior

- Knowledge

- Channels

- Phone

- Integrations

- API providers

- LLM configuration

- Tasks/capabilities

- Round-robin

- Conversations

- Leads

- Logs

- Diagnostics

- Security

- Audit history

&nbsp;

Administrative actions such as:

&nbsp;

- Enable

- Disable

- Pause

- Resume

- Stop

- Restart where supported

- Reinstall

- Regenerate credentials

- Rotate script token

- Rotate HMAC/webhook secret

- Test

- Run diagnostics

&nbsp;

must perform real server/database operations and must be audited.

&nbsp;

7. User & Client Management

&nbsp;

The admin user-management system must provide platform-wide visibility.

&nbsp;

Every relevant user/client record should expose:

&nbsp;

- Name

- Email

- Company

- Client ID

- Role

- Account status

- Signup origin

- Partner

- Origin domain

- Created date

- Last activity

- Active automations

- Subscription state

- Renewal/expiration

- Orders

- Usage

- Conversations

- Security activity

- Audit history

&nbsp;

Signup-origin badges must be consistent across the platform.

&nbsp;

Examples:

&nbsp;

- ANT HETICPLUS / Direct

- PARTNER

- PARTNER: [Partner Name]

- REFERRAL

- OTHER SOURCE

&nbsp;

Use the actual stored origin data rather than hardcoded labels.

&nbsp;

User controls must include, where authorized:

&nbsp;

- Suspend

- Unsuspend

- Ban

- Unban

- Mute

- Unmute

- Activate

- Deactivate

- Force sign-out

- Security/session controls where supported

&nbsp;

Every administrative restriction change requires:

&nbsp;

- Confirmation

- Reason

- Authorization

- Audit log

- Database enforcement

&nbsp;

A user must not be able to bypass a restriction through the frontend or direct API calls.

&nbsp;

8. Admin Must Be a True Command Center

&nbsp;

The Admin panel must not be a collection of cosmetic dashboard pages.

&nbsp;

Administrators must be able to move from:

&nbsp;

Partner → Client → Automation → Configuration → Widget → AI → Knowledge → Integration → Usage → Conversations → Health → Billing → Audit

&nbsp;

without losing context.

&nbsp;

Global search should support relevant identifiers including:

&nbsp;

- Client ID

- Name

- Email

- Company

- Domain

- Automation ID

- Order ID

- Phone

- Conversation ID

- Partner

- Origin domain

- Script/install identifier

&nbsp;

Global quick actions should include relevant actions such as:

&nbsp;

- Open client

- Open automation

- Generate script

- View verification queue

- View failing automations

- View expiring automations

- Run diagnostics

- Find domain

&nbsp;

All mutations must respect RBAC and be audited.

&nbsp;

9. Widget Requirements

&nbsp;

The production widget must use the Gen 2 architecture only.

&nbsp;

Canonical flow:

&nbsp;

Website → "widget.js" → installation token → "client_automations" → domain validation → conversation → AI runtime → RAG/tools/workflow → response

&nbsp;

The widget must never query or depend on "automation_instances".

&nbsp;

The widget must:

&nbsp;

- Load from the production "widget.js"

- Resolve the correct Gen 2 automation

- Validate installation/domain

- Respect automation active/inactive state

- Create/use Gen 2 conversations

- Store Gen 2 messages

- Track usage

- Display real runtime states

- Handle errors

- Handle offline state

- Respect rate limits/security

&nbsp;

The orb/ball must be configurable per automation from the Admin panel.

&nbsp;

Widget configuration should support applicable settings including:

&nbsp;

- Appearance

- Size

- Position

- Animation

- Glow

- Colors

- Idle state

- Listening state

- Thinking state

- Speaking state

- Message state

- Success state

- Handoff state

- Error state

- Offline state

- Welcome message

- Labels

- Sound

- Chat appearance

- Mobile/desktop behavior

- Fallback behavior

&nbsp;

Admin must be able to inspect and manage each automation's widget configuration.

&nbsp;

10. Script & Installation Management

&nbsp;

Script generation must be based on the canonical Gen 2 automation.

&nbsp;

Admin must be able to:

&nbsp;

- Select client

- Select automation

- Inspect installation

- Generate installation script

- Generate/reveal installation identifier where appropriate

- Copy script

- Rotate token

- Invalidate old token

- Reinstall

- Detect installation problems

- See whether reinstallation is required

&nbsp;

Sensitive credentials must never be exposed unnecessarily.

&nbsp;

Token rotation must invalidate previous credentials according to the security model.

&nbsp;

11. RAG Must Be Production-Grade

&nbsp;

RAG is not complete when embeddings merely exist in the database.

&nbsp;

The system must support:

&nbsp;

- Website ingestion

- Manual text

- PDF ingestion

- Chunking

- Embedding generation

- Embedding storage

- Vector search

- Similarity threshold

- Priority rules

- Client/automation isolation

- Crawl status

- Processing status

- Failure status

- Retry

- Reprocessing

- Deletion/replacement

- Admin visibility

- Usage tracking

&nbsp;

Ingestion lifecycle should support states such as:

&nbsp;

"queued → processing → completed"

&nbsp;

or

&nbsp;

"queued → processing → failed → retry"

&nbsp;

The system must expose meaningful errors when ingestion or embedding fails.

&nbsp;

Vector search must enforce tenant/automation isolation.

&nbsp;

12. AI Product Completion

&nbsp;

AI Sales Agent

&nbsp;

Must support real:

&nbsp;

- Widget interaction

- AI responses

- Knowledge/RAG

- Lead capture

- Lead qualification

- Handoff

- Conversation storage

- Usage tracking

- Health monitoring

- Admin configuration

&nbsp;

AI Receptionist

&nbsp;

Must support the actual runtime required for production, including where applicable:

&nbsp;

- Phone number

- Twilio/FastAPI integration

- Voice handling

- Greeting

- AI behavior

- Business hours

- Appointment handling

- Calendar integration

- Missed-call handling

- SMS

- Human handoff

- Call history

- Transcripts

- Usage

- Errors

- Health

- Diagnostics

&nbsp;

A management page alone does not constitute a working receptionist.

&nbsp;

Messaging AI

&nbsp;

Must support real channel runtime and applicable:

&nbsp;

- WhatsApp

- Messenger

- Instagram where supported

- Telegram

- SMS

- Webhooks

- Signature verification

- Conversation persistence

- Human handoff

- Usage

- Errors

- Health

- Diagnostics

&nbsp;

Workflow Automation

&nbsp;

Must support a real execution engine, not only a workflow editor.

&nbsp;

It must support applicable:

&nbsp;

- Triggers

- Conditions

- Actions

- Branches

- Webhooks

- Schedules

- AI actions

- Retries

- Execution history

- Failure handling

- Logs

- Usage

- Health

- Pause/resume

&nbsp;

13. Round-Robin Must Be First-Class

&nbsp;

Round-robin cannot be hidden inside arbitrary JSON configuration.

&nbsp;

It needs proper management and runtime execution.

&nbsp;

Support:

&nbsp;

- Teams

- Members

- Availability

- Active/inactive

- Priority

- Rotation order

- Assignment method

- Workload limits

- Fallback member

- Hours

- Overflow behavior

- Assignment history

&nbsp;

Strategies should support:

&nbsp;

- Round Robin

- Least Assigned

- Least Active

- Priority

- Weighted

- Manual Override

&nbsp;

Runtime flow:

&nbsp;

New qualified lead/conversation/appointment/handoff → applicable team → availability check → workload check → assignment strategy → selected member → assignment → audit/history

&nbsp;

The system must prevent duplicate or conflicting assignments where possible.

&nbsp;

14. Billing & Lifecycle

&nbsp;

Billing/lifecycle must represent real subscription state.

&nbsp;

Support:

&nbsp;

- Active

- Expiring soon

- Expired

- Grace period

- Suspended

- Stopped/cancelled where applicable

&nbsp;

The system must track:

&nbsp;

- Renewal date

- Expiration date

- Grace period

- Usage

- Subscription state

- Billing events

- Renewal history

&nbsp;

Do not display a successful renewal unless a real renewal event occurred.

&nbsp;

If recurring payment providers are not yet connected, clearly model manual renewal rather than pretending automatic billing exists.

&nbsp;

15. Provider Management

&nbsp;

Provider management must support applicable:

&nbsp;

- LLM

- Telephony

- Messaging

- Calendar

- Email

- Payment

&nbsp;

Each provider should expose:

&nbsp;

- Connection status

- Active/inactive

- Health

- Request count

- Error count

- Last success

- Last error

- Cooldown

- Failover priority

- Configuration state

&nbsp;

Secrets must remain server-side.

&nbsp;

16. Security Requirements

&nbsp;

Never trust client-provided:

&nbsp;

- Prices

- Roles

- Permissions

- Automation ownership

- Account status

- Subscription status

- Provider credentials

- Script tokens

- Administrative actions

&nbsp;

Sensitive operations must be enforced server-side and through RLS.

&nbsp;

Origin checking is useful but must not be treated as the only authentication/security mechanism.

&nbsp;

Never expose service-role credentials to browser code.

&nbsp;

Never store provider secrets in publicly readable configuration tables.

&nbsp;

All privileged mutations require authorization and appropriate audit logging.

&nbsp;

17. Audit Requirements

&nbsp;

The canonical audit table must support meaningful administrative history.

&nbsp;

At minimum, records should capture:

&nbsp;

- Actor

- Action

- Target type

- Target ID

- Timestamp

- Changed fields

- Reason where applicable

- Before/after values where appropriate

- Source/IP metadata where appropriate

- Automation/client context where applicable

&nbsp;

Examples that must be auditable:

&nbsp;

- Ban user

- Unban user

- Suspend user

- Disable automation

- Enable automation

- Token rotation

- Script generation

- Widget configuration change

- Provider change

- Payment approval

- Payment rejection

- Failover

- Round-robin change

- Integration change

- Emergency control

&nbsp;

18. Emergency Controls

&nbsp;

Emergency controls must be owner-authorized and audited.

&nbsp;

Where supported, include:

&nbsp;

- Maintenance mode

- Disable new orders

- Disable a product

- Disable an automation

- Disable an integration

- Disable an LLM provider

- Force provider failover

- Pause workflows

- Disable public widget

- Rate-limit suspicious traffic

&nbsp;

Emergency controls must have confirmation and safe recovery behavior.

&nbsp;

19. Migration Requirements

&nbsp;

Do not wait until the very end to discover that Gen 1 is still being used.

&nbsp;

As each Gen 2 replacement becomes production-ready:

&nbsp;

1. Identify Gen 1 dependencies.

2. Migrate required data.

3. Switch the feature to Gen 2.

4. Verify database reads/writes.

5. Verify RLS.

6. Verify runtime behavior.

7. Run end-to-end tests.

8. Remove the Gen 1 dependency.

9. Mark the old implementation DEPRECATED.

&nbsp;

Gen 1 may remain temporarily for rollback, but it must not remain an active parallel runtime indefinitely.

&nbsp;

No Gen 1 table or route should be considered part of the final architecture.

&nbsp;

20. Schema Change Policy

&nbsp;

Schema changes may initially be additive for safety.

&nbsp;

However, once:

&nbsp;

- data migration is verified,

- Gen 2 is confirmed as the active runtime,

- all references to the old structure are removed,

- rollback requirements are satisfied,

&nbsp;

deprecated Gen 1 structures may be removed during final retirement.

&nbsp;

Do not permanently preserve dead tables solely because they existed historically.

&nbsp;

21. Testing Requirements

&nbsp;

Every stage must have automated and manual verification.

&nbsp;

At minimum test:

&nbsp;

- Authentication

- RBAC

- RLS

- Tenant isolation

- Partner isolation

- Admin authorization

- Normal client behavior

- Invalid requests

- Unauthorized requests

- Expired subscriptions

- Suspended/banned users

- Provider failures

- API failures

- Integration failures

- Widget installation

- Wrong-domain widget access

- Token rotation

- RAG failures

- Workflow failures

- Round-robin assignment

- Audit logging

&nbsp;

Use Playwright for critical user flows and database read-back verification for important mutations.

&nbsp;

22. Stage Completion Gate

&nbsp;

Do NOT advance to the next stage simply because the planned UI has been created.

&nbsp;

A stage is complete only when:

&nbsp;

- UI works

- Database works

- RLS works

- Server authorization works

- Runtime works

- Integrations work where applicable

- Error handling works

- Usage tracking works

- Health monitoring works

- Audit logging works

- Security tests pass

- End-to-end tests pass

- Database read-back confirms expected state

- No new Gen 1 dependency was introduced

&nbsp;

If something is intentionally deferred, explicitly mark it as deferred rather than presenting the feature as complete.

&nbsp;

23. Final Definition of Done

&nbsp;

AntheticPlus v1.1 is complete only when the platform satisfies all three layers of truth:

&nbsp;

Product Truth

&nbsp;

The UI, workflows, settings, dashboards and controls behave as specified.

&nbsp;

Runtime Truth

&nbsp;

The actual automation engines, AI, channels, integrations, workflows, RAG, widget, usage and health systems work in production.

&nbsp;

Administrative Truth

&nbsp;

The Admin Command Center can inspect, configure, control, diagnose, secure, audit and manage the real underlying systems.

&nbsp;

The final platform must not be a UI prototype.

&nbsp;

It must be a functioning production SaaS platform where the Admin Command Center controls the actual underlying AntheticPlus infrastructure.