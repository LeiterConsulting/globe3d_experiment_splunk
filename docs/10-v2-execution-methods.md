# V2 Execution Methods and Delivery Summary

This document summarizes what was implemented, how it was validated, and how to continue extending the V2 tech demo.

## Build track setup (completed)

- V2 app package source: `splunk_app/splunk_globe_app_v2`
- V2 package command: `npm run package:splunk`
- V2 readiness workflow: `npm run demo:smoke`, `npm run demo:readiness`, `npm run demo:ready`

## Implementation themes

### Theme A — Confidence and provenance

Delivered:

1. Confidence model fields for rendered entities and summary status
2. Provenance details with freshness and stale-age handling
3. Operational payload snapshots suitable for export and review

Verification checks:

- Confidence indicators appear in UI/payload
- Fallback behavior is visible to users
- Export surfaces include confidence/provenance details

### Theme B — Telemetry and visual guardrails

Delivered:

1. In-panel render telemetry/status indicators
2. Warning/critical status treatment in embed overlays
3. Clear at-a-glance behavior under degraded or stale conditions

Verification checks:

- Status transitions are visible without developer tools
- Overlay treatment changes with telemetry state
- Interaction remains stable while status updates occur

### Theme C — Layer registry and adapter scaffolding

Delivered:

1. Registry metadata and per-layer status summary
2. Adapter lifecycle wiring (`connect`, `health`, `fetch`, `normalize`)
3. Simulated feed path for repeatable end-to-end testing

Verification checks:

- Adapter lifecycle is exercised at runtime
- Registry summary appears in operational payload
- Layer disable/degrade behavior works without renderer-core edits

### Theme D — Non-terrestrial showcase mode

Delivered:

1. Toggleable non-terrestrial object rendering
2. Launch-event mode for visual emphasis
3. Dataset-backed orbital assets with fallback behavior

Verification checks:

- Orbital object/beam rendering appears when enabled
- Legend reflects orbital count and dataset summary
- Mode-off fallback returns cleanly to baseline overlays

## Data generation methods

- Build hierarchy expansion assets: `npm run data:expand:hierarchy`
- Build region layer assets: `npm run data:regions:build`
- Build orbital datasets: `npm run data:orbital:build`

## Validation and release methods

1. Run `npm run demo:smoke` for package + wiring assertions.
2. Run `npm run demo:readiness` for readiness report generation.
3. Run `npm run demo:ready` for full demo prep (datasets + readiness + package).
4. Install `build/splunk_globe_app_v2.tar.gz` in Splunk.

## Produced artifacts

- Install package: `build/splunk_globe_app_v2.tar.gz`
- Readiness report: `docs/reports/v2-readiness-report.md`
- Orbital datasets:
  - `splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/catalog.json`
  - `splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/timeseries-latest.json`
  - `splunk_app/splunk_globe_app_v2/lookups/orbital_objects_seed.csv`
