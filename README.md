# globe3d_experiment_splunk (V2)

This repository is the V2-only Splunk globe application for ops-center demo and validation workflows.

[![Release](https://img.shields.io/badge/release-v2.0.0-blue)](https://github.com/LeiterConsulting/globe3d_experiment_splunk/releases)
[![Platform](https://img.shields.io/badge/platform-Splunk-lightgrey)](https://www.splunk.com)
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-61dafb)](https://react.dev)

## Scope

- Primary app ID: `splunk_globe_app_v2`
- Build target: Splunk static bundle + installable app package
- Demo focus: operational confidence/provenance + non-terrestrial/launch-event visualization

## Feature overview

- Hierarchical region drilldown and globe navigation
- Great-circle arc rendering with link filtering controls
- Operational confidence/provenance surface and telemetry status treatment
- Toggleable non-terrestrial objects and launch-event mode
- Dataset-backed orbital rendering with fallback behavior

## Architecture at a glance

- UI orchestration: `src/NextGenPage.tsx`
- Splunk app package: `splunk_app/splunk_globe_app_v2/`
- 3D embed renderer: `splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html`
- Build/package automation: `scripts/`

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

## Dataset workflows

- `npm run data:expand:hierarchy` — generate hierarchy-expanded point lookup assets
- `npm run data:regions:build` — build region-layer static and lookup assets
- `npm run data:orbital:build` — generate orbital catalog/timeseries/seed outputs

Primary generated orbital outputs:

- `splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/catalog.json`
- `splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/timeseries-latest.json`
- `splunk_app/splunk_globe_app_v2/lookups/orbital_objects_seed.csv`

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

## Customization guide

1. Adjust payload and UI behavior in `src/NextGenPage.tsx`.
2. Tune visual rendering and legend behavior in `nextgen-embed/index.html`.
3. Modify data-generation assumptions in `scripts/generate-*.mjs`.
4. Update readiness criteria in the readiness automation script in `scripts/`.

## Release workflow

1. Run `npm run demo:ready`.
2. Verify report: `docs/reports/v2-readiness-report.md`.
3. Upload `build/splunk_globe_app_v2.tar.gz` to GitHub Release assets.
4. Copy summary bullets from `CHANGELOG.md` into the Release notes.

## Documentation

- `docs/09-tech-demo-implementation-plan.md`
- `docs/10-v2-execution-methods.md`
- `CHANGELOG.md`

Local-only (gitignored) docs used for demo prep can still exist in your workspace:

- `docs/08-advanced-upgrade-roadmap.md`
- `docs/11-v2-demo-run-sheet.md`
- `docs/12-v2-demo-narrator-script.md`
- `docs/reports/v2-readiness-report.md`

