<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- All AI calls go through routeChat() in src/lib/llm-router.server.ts (llm_api_keys by priority → Lovable AI), logged to llm_requests — one canonical provider path.
- Widget runtime resolves only client_automations by script_token; served at /widget.js from src/lib/widget-runtime.ts — Gen 1 automation_instances is retired for widgets.
- Orders are created only via the place_order() RPC which prices from product_prices — never trust browser totals.
