# NASA Q1 Readiness Report (V2)

Generated: 2026-02-24T20:16:49.214Z

## Summary

- Checks passed: 9/9
- Overall status: READY FOR IN-SPLUNK TEST PHASE

## Verification Checklist

- [x] V2 package artifact exists — PASS (build/splunk_globe_app_v2.tar.gz)
- [x] Operational confidence card exists — PASS (src/NextGenPage.tsx)
- [x] Per-layer provenance + registry summary wired — PASS (src/NextGenPage.tsx)
- [x] Pilot adapter lifecycle wired (connect/health/fetch/normalize) — PASS (src/NextGenPage.tsx)
- [x] Embed stale/critical visual status treatment active — PASS (splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html)
- [x] Layer registry + simulated adapter scaffolding exists — PASS (src/nasa/layerRegistry.ts, src/nasa/simulatedTrajectoryAdapter.ts)
- [x] Orbital dataset artifacts generated for V2 — PASS (splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/catalog.json, splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/timeseries-latest.json, splunk_app/splunk_globe_app_v2/lookups/orbital_objects_seed.csv)
- [x] Non-terrestrial + launch-event payload controls wired — PASS (src/NextGenPage.tsx)
- [x] Embed orbital rendering + launch-event legend treatment active — PASS (splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html)

## Risk Register

| ID | Risk | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| R1 | Pilot adapter feed remains simulated and not connected to mission telemetry. | High | Implement production adapter with authenticated source and health SLOs in Q2. | Platform + Data Ingest |
| R2 | Render telemetry is in-overlay only and not persisted to external observability stack. | Medium | Add telemetry sink export hooks and dashboard ingestion in next phase. | Frontend + SRE |
| R3 | Confidence model remains heuristic and not calibrated against mission truth sets. | High | Define calibration dataset and run threshold tuning during ops rehearsal. | Analytics + Mission Ops |
| R4 | In-Splunk validation has not yet been executed in target operational role contexts. | Medium | Run install + role-based smoke in Splunk test stack (Commander/Analyst/Watch Officer). | Splunk App QA |
| R5 | Orbital launch-event mode has not yet been validated with operators under live in-Splunk load. | Medium | Run launch-mode scenario walkthrough in Splunk and collect operator acceptance notes for legend/status readability. | Mission UX + Splunk App QA |

## In-Splunk Acceptance Matrix (Non-Terrestrial / Launch)

| Acceptance ID | Scenario | Commander | Analyst | Watch Officer | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| NT-01 | Enable **Show non-terrestrial tracked objects** and verify orbital points + beams render with expected legend updates. | PENDING | PENDING | PENDING | |
| NT-02 | Enable **Launch event mode** and verify visual emphasis, launch-specific legend/status updates, and interaction continuity. | PENDING | PENDING | PENDING | |
| NT-03 | Disable non-terrestrial mode and verify clean fallback (orbital layers removed, core mission overlays unaffected). | PENDING | PENDING | PENDING | |

## PASS/FAIL Rubric (NT Scenarios)

- PASS: Scenario behavior matches expected visual and legend state with no blocking interaction defects.
- FAIL: Missing or incorrect orbital visuals, incorrect legend or status text, or interaction breaks operator flow.
- Evidence required: screenshot or short recording, timestamp, tester role, and issue/confirmation note.
- Severity tags: Blocker (cannot proceed), Major (workflow degraded), Minor (cosmetic or non-blocking).

## Next In-Splunk Test Phase

1. Install [build/splunk_globe_app_v2.tar.gz](../../build/splunk_globe_app_v2.tar.gz) in Splunk test environment.
2. Validate role-based access and endpoint behavior for Commander/Analyst/Watch Officer personas.
3. Exercise drilldown + focus + overlays + telemetry status transitions under realistic data load.
4. Validate non-terrestrial toggle and launch event mode behavior (objects, beams, legend updates) in live role sessions.
5. Execute NT-01 through NT-03 and mark each persona result as PASS/FAIL with evidence.
6. Capture operator feedback and threshold tuning notes into this report.
