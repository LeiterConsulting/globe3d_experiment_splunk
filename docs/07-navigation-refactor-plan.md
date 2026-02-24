# Navigation Refactor Plan (Spec Review + Execution)

## Scope
Refactor camera/navigation only for `webgl-globe` runtime while leaving rendering overlays and data pipeline unchanged.

Target files:
- `splunk_app/splunk_globe_app/appserver/static/vendor/webgl-globe/globe.js`
- `splunk_app/splunk_globe_app/appserver/static/nextgen-embed/index.html` (only for config wiring if needed)

## Current Baseline Constraints
- Navigation is currently a single orbit controller (`target.x/y` + center look-at).
- Drag handling is tightly coupled to orbit math in `onMouseMove`.
- Zoom is radial-only (`distanceTarget`) and not cursor-aware.
- No projection-mode abstraction exists today.

## Recommended Architecture in This Codebase
Implement a lightweight state machine first (inside `globe.js`) before splitting into separate files:

- `NAV_MODE_GLOBAL`
- `NAV_MODE_SURFACE`
- `NAV_MODE_LOCAL`

Then progressively extract mode logic into internal controller objects:
- `globalController.updateDrag(...)`
- `surfaceController.updateDrag(...)`
- `localController.updateDrag(...)`

This keeps risk low while proving behavior.

## Execution Phases

### Phase 1 (Low Risk, High Value)
1. Add navigation mode state machine driven by altitude thresholds.
2. Add per-mode tilt clamps.
3. Add altitude-scaled rotation sensitivity.
4. Add cursor-based zoom target (ray-sphere hit on wheel).
5. Add 200ms mode transition blend scalar.

Success criteria:
- No regressions in normal globe orbit.
- Zoom moves toward cursor hit region.
- Close zoom no longer feels over-sensitive.

### Phase 2 (Surface Pivot)
1. Compute dynamic pivot from cursor raycast intersection.
2. In SURFACE mode, orbit and pan around pivot on globe surface.
3. Blend from center-orbit to pivot-orbit during mode transition.

Success criteria:
- Country/state scale drag tracks intended area.
- No slingshot when crossing hemisphere boundaries.

### Phase 3 (Local Tangent Plane)
1. Create ENU frame at pivot (east/north/up basis).
2. In LOCAL mode, convert drag to planar translation in tangent frame.
3. Limit rotation to yaw-dominant behavior and low pitch.
4. Stabilize horizon with smooth `camera.up` interpolation toward local normal.

Success criteria:
- City-scale pan feels map-like and stable.
- No camera inversion or aggressive roll.

### Phase 4 (Hardening + Diagnostics)
1. Add debug overlay state (`mode`, `altitude`, `pivot`, `blend`).
2. Add interaction telemetry counters (raycast hits/misses).
3. Tune thresholds from observed UX.

Success criteria:
- Predictable transitions and measurable mode behavior.
- Stable on repeated zoom-in/out cycles.

## Suggested Initial Thresholds
- `GLOBAL_THRESHOLD = 480`
- `MID_THRESHOLD = 300`
- Blend duration: `200ms`
- Max tilt:
  - Global: `80°`
  - Surface: `60°`
  - Local: `30°`

(These are starting points; tune empirically.)

## Technical Notes for This Engine Version
- Three.js version is older; prefer custom ray-sphere math over newer helpers for compatibility.
- Avoid per-frame object allocations; reuse vectors where possible.
- Keep wheel/raycast work event-driven (not continuous per frame).

## Risks and Mitigations
- Risk: abrupt mode-switch feel.
  - Mitigation: blend factor with hysteresis around thresholds.
- Risk: discontinuity in yaw wrapping.
  - Mitigation: shortest-angle normalization on all mode handoffs.
- Risk: local mode drift.
  - Mitigation: periodic re-anchor of ENU frame to active pivot.

## Test Matrix
At each level (continent/nation/state/county/city), validate:
- Drag intent match
- Cursor-zoom accuracy
- Tilt constraints
- Horizon stability
- Transition smoothness (zoom in/out repeatedly)

## Definition of Done
- City-level navigation is stable and map-like.
- Global orbit still feels natural.
- Cursor zoom and transitions are predictable.
- No regressions in overlay rendering or drilldown interactions.
