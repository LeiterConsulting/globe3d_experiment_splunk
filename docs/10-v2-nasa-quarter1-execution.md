# V2 NASA Plan — Quarter 1 Execution

This execution document starts the NASA-style adoption plan on the dedicated v2 track (`splunk_globe_app_v2`).

## Track setup (completed)

- Dedicated Splunk app folder exists: `splunk_app/splunk_globe_app_v2`
- Dedicated package script exists: `npm run package:splunk:v2`
- Frontend/build/scripts support app-id targeting via env/flags

## Quarter 1 objective

Establish **trust and instrumentation** so operators can rely on the visualization under load.

## Epic Q1-A — Confidence and provenance foundation

### Deliverables

1. Confidence model v1 for rendered entities
   - Region confidence: geometry quality + fallback penalties
   - Arc confidence: source confidence + path interpolation reliability
   - Layer confidence summary for current viewport
2. Provenance surface v1
   - Data source labels on overlays
   - Last update timestamp + stale age indicator
   - Exportable confidence/provenance snapshot

### Acceptance checks

- Every major overlay reports a confidence score in [0,1]
- Fallback strategy is visible to operators
- Confidence snapshot export works in JSON/CSV

## Epic Q1-B — Telemetry and SLO guardrails

### Deliverables

1. Render SLO dashboard in-panel
   - Frame time `p50/p95/max`
   - Data staleness age
   - Overlay entity counts by level
2. Threshold policy
   - Warning and critical states for latency and stale data age
   - Degradation policy linked to thresholds

### Acceptance checks

- SLO state can be determined at a glance
- Threshold breach is visible without opening developer tools
- Degradation mode engages predictably

## Epic Q1-C — Ingest and layer registry scaffolding

### Deliverables

1. Layer registry contract
   - Layer id, source, schema, confidence function, renderer binding
2. Ingest adapter abstraction
   - Adapter lifecycle (`connect`, `health`, `fetch`, `normalize`)
3. Dry-run adapter for simulated mission feed

### Acceptance checks

- New layer can be registered without editing renderer core
- Adapter health state can disable a layer safely
- Simulated feed can exercise end-to-end path

## Sprint map (6-week Q1 starter)

### Sprint 1 (Weeks 1-2)

- Add confidence legend panel and export payload extension
- Add render telemetry summary card and threshold status chips
- Add app-id aware build/package verification for v2
- Add repeatable smoke command: `npm run nasa:q1:smoke:v2`

### Sprint 2 (Weeks 3-4)

- Add provenance fields to region/arc payloads
- Add stale age computation + warning states
- Define initial layer registry interfaces and one pilot layer

Status update:

- Added per-layer provenance details and registry summary into V2 ops payload.
- Added overlay warning/critical visual state treatment driven by stale/render/confidence status.
- Added initial registry and adapter scaffolding in `src/nasa/layerRegistry.ts` and `src/nasa/simulatedTrajectoryAdapter.ts`.

### Sprint 3 (Weeks 5-6)

- Add ingest adapter skeleton + simulated feed
- Add automated smoke checklist for v2 package
- Freeze Q1 readiness report and risk register

Status update:

- Adapter lifecycle is wired in runtime (`connect`, `health`, `fetch`, `normalize`) with periodic checks and sample tracking.
- Ops payload now includes pilot adapter runtime status/details and per-layer registry metadata.
- Added readiness report command: `npm run nasa:q1:readiness:v2` (runs smoke and writes `docs/reports/nasa-q1-readiness-v2.md`).

## Immediate backlog (next implementation pass)

1. Add confidence legend card in `NextGenPage` sidebar.
2. Extend embed legend with stale-age and threshold status.
3. Add `nasa:q1:smoke:v2` script for repeatable validation.
4. Define TypeScript interfaces for `LayerRegistry` and `IngestAdapter`.
5. Add simulated adapter that emits trajectory-like payloads.

## Orbital dataset update (implemented)

- Added dataset generation command for orbital overlays: `npm run data:orbital:build:v2`
- Generated assets now live at:
   - `splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/catalog.json`
   - `splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/timeseries-latest.json`
   - `splunk_app/splunk_globe_app_v2/lookups/orbital_objects_seed.csv`
- `NextGenPage` now prefers dataset-backed orbital objects and falls back to frame/demo objects if datasets are unavailable.
