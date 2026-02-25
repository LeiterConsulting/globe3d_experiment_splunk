# V2 Tech Demo Implementation Plan

This document defines how the V2 globe app is implemented, what features are in scope, and how to extend it for additional demo scenarios.

## Product intent

- Positioning: interactive geospatial technology demo
- Runtime target: Splunk app package (`splunk_globe_app_v2`)
- Core value: combine operational overlays, confidence/provenance signals, and optional non-terrestrial context in one experience

## Feature pillars

### 1) Navigation and map context

- Hierarchical drilldown path (continent → country → state → county → city)
- Focus controls with level-aware camera behavior
- Search limited to known loaded locations
- Great-circle arc rendering with filtering controls

### 2) Operational trust surface

- Confidence model with summary and per-layer details
- Provenance fields and stale-age treatment
- In-panel telemetry and status thresholds
- Export-ready operational snapshot (JSON/CSV)

### 3) Non-terrestrial showcase layer

- Optional toggle to render tracked orbital objects
- Optional launch-event mode for visual emphasis
- Dataset-backed rendering with controlled fallback behavior
- Legend updates for orbital counts and dataset summary

## Data model and dataset pipeline

### Region and hierarchy datasets

- Source generation scripts build region layer assets and hierarchy lookup outputs
- Assets are synchronized into the V2 app static and lookup folders

### Orbital datasets

- Generated with: `npm run data:orbital:build`
- Outputs:
  - `splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/catalog.json`
  - `splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/timeseries-latest.json`
  - `splunk_app/splunk_globe_app_v2/lookups/orbital_objects_seed.csv`

## Architecture notes

- Frontend orchestration: `src/NextGenPage.tsx`
- Splunk entrypoint: `src/splunk/splunkMain.tsx`
- Embed renderer: `splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html`
- Vendor globe runtime: `splunk_app/splunk_globe_app_v2/appserver/static/vendor/webgl-globe/globe.js`
- Registry/adapter scaffolding exists in the adapter module folder under `src/` (current path naming is retained for compatibility)

## Build, package, and validation flow

- Build bundle: `npm run build:splunk`
- Package app: `npm run package:splunk`
- Run smoke checks: `npm run demo:smoke`
- Generate readiness report: `npm run demo:readiness`
- Full prep (datasets + readiness + package): `npm run demo:ready`

## Customization guide

1. **Overlay behavior**: adjust layer toggles and payload construction in `src/NextGenPage.tsx`.
2. **Render styling**: tune marker/arc visuals in `nextgen-embed/index.html`.
3. **Dataset shape**: update generator scripts in `scripts/` and rerun data build commands.
4. **Readiness criteria**: modify checks and acceptance matrix in the readiness automation script under `scripts/`.
5. **Demo narrative**: adapt run sheet and narrator script in `docs/11-*` and `docs/12-*`.

## Current execution details

For sprint-level implementation details and delivered work summary, see:

- `docs/10-v2-execution-methods.md`
