# AI Receptionist Platform

https://github.com/antheticplusstudios-lab/antheticplus.git. can you clone this repository its a project from my another workspace and I want you to clone it and build it and inspect what's left what's done I have some info too.  You give me in that workspace I was working . I'll inspect AntheticPlus to see where things stand and pull together a summary and next steps.















AntheticPlus Studios is an AI agency platform for deploying and managing embeddable website AI receptionists and automations for business clients.















What it does today















- Client storefront & checkout: Visitors browse available automations, select pricing plans, and submit proof of payment.







- Payment verification queue: Staff review incoming payments, approve or reject submissions, and write immutable audit logs.







- One-click provisioning: Approving a payment triggers an automated crawl of the client's website, compiles business knowledge, activates the automation, and generates a domain-gated embed script.







- Resilient AI chat widget: A lightweight embeddable widget powered by a pooled Groq LLM router with automatic cooldown handling, failover logging, and fallback to Lovable AI.







- Client & admin portals: Clients track subscription expiry and copy their embed script; admins monitor infrastructure, failovers, prompt baselines, and team permissions.















---















What's done vs. what's left















- Done:







  - Full client checkout and manual payment verification workflow.







  - One-click automated website crawler and knowledge ingestion upon approval.







  - Groq key rotation pool with automatic failover and audit records.







  - Embed script generator and public widget chat API with domain validation.







  - Role-gated admin console (Owner, Partner, Payment Verifier) and client dashboard.







- Left:







  - Live in-app chat test panel on the client's automation dashboard.







  - Immediate snippet delivery modal in the Verification Queue when a payment is approved.







  - Direct URL scraping input on the admin Knowledge Drafts page (currently requires manual text pasting).







  - Dedicated "All Automations" admin manager for toggling catalog visibility and editing offerings.















---















Three highest-impact improvements to make next















1. "Test Your Receptionist" simulator in the client dashboard  







   Add an interactive chat test panel on the client's automation page (`/dashboard/automations/$id`) so clients can test conversation quality, tone, and crawled business knowledge before pasting the script onto their live site.















2. Instant script delivery & crawl summary modal on payment approval  







   Display an approval modal in the Verification Queue immediately showing the crawl outcome, the generated script tag with a one-click copy button, and a shortcut to open the newly provisioned instance.















3. One-click URL scraper on the admin Knowledge Drafts page  







   Add a URL input field on the knowledge management page so admins can pull live content directly from any website or FAQ URL instead of pasting raw text manually.



Lclone the repo make a new project and start building

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/94ea0507-676a-423b-904a-59bdb6c4fcea).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
