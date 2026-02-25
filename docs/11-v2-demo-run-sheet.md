# V2 Demo Run Sheet (Splunk Install + Live Walkthrough)

## One-command demo prep

From project root:

```bash
npm run demo:ready
```

Outputs:

- Install package: `build/splunk_globe_app_v2.tar.gz`
- Readiness report: `docs/reports/v2-readiness-report.md`

## Splunk install

1. In Splunk Web, open **Apps > Manage Apps > Install app from file**.
2. Upload `build/splunk_globe_app_v2.tar.gz`.
3. Restart Splunk if prompted.
4. Open the v2 app.

## 8-minute demo flow

### 1) Baseline operational view (2 min)

- Show core globe overlays and telemetry/status panel.
- Point out confidence/provenance/readiness guardrails.

### 2) Non-terrestrial mode (3 min)

- Enable **Show non-terrestrial tracked objects**.
- Confirm orbital objects + beams appear.
- Call out legend updates for orbital counts and dataset summary.

### 3) Launch event mode (2 min)

- Enable **Launch event mode**.
- Confirm visual emphasis and launch-oriented legend/status behavior.
- Verify pan/drag/drill interactions remain stable.

### 4) Fallback and resilience (1 min)

- Disable non-terrestrial mode.
- Confirm orbital layers clear and core mission overlays remain intact.

## Acceptance capture during demo

Record results directly in `docs/reports/v2-readiness-report.md` under:

- NT-01: non-terrestrial render + legend behavior
- NT-02: launch event mode behavior
- NT-03: clean fallback behavior

For each role (Commander/Analyst/Watch Officer), mark `PASS` or `FAIL` and include evidence notes.

## Demo-day quick checks

- Package timestamp is from current prep run.
- App loads without JS errors.
- Orbital dataset summary is visible when non-terrestrial mode is enabled.
- Launch mode toggles cleanly without interaction regressions.
