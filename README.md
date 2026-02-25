# globe3d_experiment_splunk (V2)

This repository is the V2-only Splunk globe application for ops-center demo and validation workflows.

## Scope

- Primary app ID: `splunk_globe_app_v2`
- Build target: Splunk static bundle + installable app package
- Demo focus: operational confidence/provenance + non-terrestrial/launch-event visualization

## Quickstart

```bash
npm install
npm run demo:ready
```

Outputs:

- Install package: `build/splunk_globe_app_v2.tar.gz`
- Readiness report: `docs/reports/v2-readiness-report.md`

## Core commands

- `npm run build:splunk` — build Splunk bundle for V2
- `npm run splunk:sync` — sync built assets into `splunk_app/splunk_globe_app_v2/appserver/static`
- `npm run package:splunk` — create install package `build/splunk_globe_app_v2.tar.gz`
- `npm run demo:smoke` — package + wiring assertions
- `npm run demo:readiness` — smoke + readiness report generation
- `npm run demo:ready` — orbital data refresh + readiness + fresh install package

## Splunk install

1. In Splunk Web: **Apps > Manage Apps > Install app from file**
2. Upload `build/splunk_globe_app_v2.tar.gz`
3. Restart Splunk if prompted
4. Open the V2 app

## Repository layout

- `src/` — React/TypeScript UI and payload logic
- `splunk_app/splunk_globe_app_v2/` — Splunk app package source
- `scripts/` — build, package, dataset generation, smoke/readiness automation
- `docs/reports/` — generated readiness report output

## Documentation

- `docs/08-advanced-upgrade-roadmap.md`
- `docs/09-tech-demo-implementation-plan.md`
- `docs/10-v2-execution-methods.md`
- `docs/11-v2-demo-run-sheet.md`
- `docs/12-v2-demo-narrator-script.md`
- `docs/reports/v2-readiness-report.md`

