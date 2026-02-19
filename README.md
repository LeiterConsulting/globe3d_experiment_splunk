# How to Make a React + Vite Splunk App (Starter Kit)

This repository is a drop-in starter for building rich Splunk apps with:

- TypeScript + React + Vite frontend
- Splunk persistent REST backend (`restmap.conf` + Python handler)
- Optional Splunk Web custom controller proxy (for resilient browser calls)
- Splunk packaging scripts (`tar.gz`) for app install testing

It is based on proven patterns used in your production-style apps (`AppCanvas`, `LLM Proxy`, and this terminal app debug cycle).

## What you get

- A working end-to-end vertical slice (UI → controller proxy → splunkd REST handler)
- Defensive frontend path fallback across Splunk environments
- Capability-gated backend behavior and conf-driven runtime settings
- Repeatable build/sync/package flow

## Quickstart

```bash
npm install
npm run build:splunk
npm run package:splunk
```

Install output:

- `build/splunk_terminal_app.tar.gz`

## Starter structure

- `src/` — React UI and TS client
- `src/llmProxySdk/splunkFetch.ts` — shared Splunk URL/fetch helpers
- `splunk_app/splunk_terminal_app/bin/terminal_access.py` — persistent REST handler
- `splunk_app/splunk_terminal_app/default/restmap.conf` — REST endpoint registrations
- `splunk_app/splunk_terminal_app/default/web.conf` — Splunk Web exposure rules
- `splunk_app/splunk_terminal_app/appserver/controllers/terminal_rest_proxy.py` — custom controller proxy
- `scripts/splunk-sync.mjs` — copies built JS/CSS to Splunk static path
- `scripts/splunk-package.mjs` — creates install tarball

## Make this your own app in minutes

The default app ID is currently `splunk_terminal_app` to keep this template immediately runnable.

Use the rename helper to generate your own app identity:

```bash
npm run template:rename -- --appId my_new_app --appLabel "My New App"
```

This updates common IDs/labels in frontend + Splunk config files.

## Recommended prototype flow

1. Duplicate this repo/folder into your workspace.
2. Run `template:rename` for your target app ID.
3. Replace `src/App.tsx` UI panels with your prototype domain.
4. Replace `terminal_access.py` logic with your service logic.
5. Keep `restmap.conf`, `web.conf`, and controller proxy pattern intact.
6. Build/package/install and iterate quickly.

## Key hardening lessons baked into this template

- Prefer explicit `restmap.conf` route matches for critical endpoints.
- Keep a custom controller proxy available when `splunkd/__raw/services*` behavior is inconsistent.
- Use robust session-key extraction (`session.authtoken`, header variants).
- Separate capability checks from route registration diagnosis.

## Documentation

- `docs/01-architecture.md`
- `docs/02-build-package-install.md`
- `docs/03-proxy-and-routing-patterns.md`
- `docs/04-rapid-prototype-checklist.md`

