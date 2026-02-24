# Done Definition + Drop-in Bootstrap

This document defines what “done” looks like for the globe app and how another developer can drop this baseline into a new Splunk app with minimal risk.

## 1) Definition of Done (product + engineering)

A release candidate is done when all items below are true:

- Single production UI path exists (no legacy/classic branch in runtime navigation).
- Region drilldown works for all hierarchy levels used by the dataset.
- Country boundaries are authoritative for all represented countries.
- State/province boundaries are authoritative where available; explicit fallback strategy is visible for unmatched regions.
- Zoom behavior is monotonic with selection spread (smaller geographic spread zooms in, larger spread zooms out).
- Local levels (county/city) render with adequate feature density and remain interactive.
- Close-zoom visuals are crisp on high-DPI displays (pixel ratio + filtering configured).
- Build, package, and Splunk install path are repeatable using repository scripts.

## 2) Drop-in bootstrap checklist

### Step A: Clone and rename app identity

```bash
npm install
npm run template:rename -- --appId my_new_app --appLabel "My New App"
```

### Step B: Keep platform plumbing, swap domain logic

Keep these files/patterns intact:

- `default/restmap.conf`
- `default/web.conf`
- `appserver/controllers/*` proxy pattern
- `src/llmProxySdk/splunkFetch.ts` fallback behavior

Replace these with your domain:

- `src/NextGenPage.tsx` (or equivalent feature page)
- `bin/terminal_access.py` backend business logic
- lookup/dataset sources under `splunk_app/*/lookups`

### Step C: Build/package and install

```bash
npm run build:splunk
npm run package:splunk
```

Expected artifact:

- `build/splunk_globe_app.tar.gz`

Install into Splunk apps directory and restart Splunk.

### Step D: Smoke test (must pass)

- App page loads without console errors.
- UI receives data from controller proxy path.
- Proxy fallback paths still work in your target Splunk environment.
- Drilldown updates region layer + focus camera.
- Region quality diagnostics render when debug toggle is enabled.

## 3) Region boundary quality gates

Use these gates before claiming geographic quality:

- Country gate: 100% represented countries matched to admin-0 boundaries.
- State gate: report matched vs fallback counts and document unresolved aggregate labels.
- Fallback gate: unmatched regions use conservative hull/bbox behavior (never misleading authoritative claims).

## 4) Operational handoff notes

For each release, record:

- Region asset generation stats (matched/fallback counts).
- Build artifact name + timestamp.
- Splunk version/environment tested.
- Known geographic limitations (if any) with explicit mitigation.

This keeps adoption friction low when the same baseline is reused by another team/app.
