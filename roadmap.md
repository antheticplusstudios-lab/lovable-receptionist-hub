# AntheticPlus Studios — build roadmap

## Phase 1 — Client Portal
- [x] Profile completion lockout (dashboard blurs until the profile is finished)
- [x] 4-step checkout: details → business context → billing cycle → payment reference
- [x] Manual payment methods (Crypto / Bank / Mobile Money) with transaction ID + sender name
- [x] Client payments page shows pending / approved / rejected with the rejection reason
- [ ] Reactivation modal on expiry (exists in code, not yet exercised in the browser)

## Phase 2 — Admin Control Center (all 10 pages live)
- [x] Command Center: MRR, active automations, leads, conversations, attribution, urgent actions
- [x] Orders Ledger with filters + CSV export
- [x] Verification Queue: approve / reject, reason required on reject
- [x] Automation Creator (one-click provision → Active)
- [x] Automations & Transcripts: statuses, kill switch, prompt override
- [x] Client CRM & Tags
- [x] Subscription Lifecycle page + `/api/public/hooks/lifecycle` endpoint
- [x] Pricing Configurator + promo codes (both storefronts read live)
- [x] Infrastructure & Groq Pool: key pool, primary toggle, failover log, global prompts
- [x] Team & Audit Trail: invite / revoke, audit log

## Phase 3 — Backend wiring
- [x] 3-tier RBAC enforced server-side and in row-level security
- [x] End-to-end order proven: checkout → pending payment → approve → Active / Paid
- [x] Daily lifecycle schedule (runs every day at 02:00 UTC)
- [ ] Transactional emails — blocked on a sending-domain decision

## Phase 4 — Experience polish
- [x] In-page sign in / sign up dialog (stays on the current page, returns to origin)
- [x] Persistent site navigation for signed-out visitors
- [x] Lightweight Framer Motion transitions across storefront, checkout and admin
- [x] AI assistant button in the Control Center header (Owner / Partner)
- [x] OpenRouter key + model settable from Infrastructure
- [ ] Assistant live test — waiting on a real OpenRouter key from you

## Needs you
- OpenRouter API key (paste on Infrastructure → AI assistant)
- Groq API keys for the pool
- Email sending domain choice before client emails go out

## Phase 5 — Specialized refactor (approved plan)
- [x] Homepage shows only AI Receptionist + Social DM agent (others stay live in dashboards/admin)
- [x] Fix white flash on refresh (theme applied before first paint)
- [x] AI key management (Groq pool, OpenRouter key) owner-only in app + menu
- [ ] Owner-only database rules on key tables — blocked: migration tool replays old files on the remixed database
- [x] One-click approve = crawl + script compile + provisioning
- [ ] Per-automation pages, 10-task configurator, script auto-regeneration, OpenRouter failover, usage metering, Google integrations, flow tests

## Phase 6 — Migration + top improvements
- [x] Rebuilt database on Lovable Cloud (22 tables, roles, approval/provisioning logic)
- [x] Test-your-receptionist chat on client automation page
- [x] Script delivery popup with crawl summary on payment approval
- [x] Fetch-page-by-URL on Knowledge Drafts
- [x] Animated 404 / 500 pages
- [ ] Old workspace data import — skipped for now by request
- [ ] "All Automations" catalog manager for admins
