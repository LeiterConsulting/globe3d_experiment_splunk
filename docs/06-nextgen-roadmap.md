# NEXT GEN Roadmap (Hierarchy + Visual Fidelity)

## Goal
Deliver a reliable geospatial exploration workflow where users can drill from continent to city with immediate visual feedback, distinct rendering styles, and measurable UX/performance quality.

## Current Gaps (Observed)
- Drilldown currently feels manual/inconsistent instead of stepwise and guided.
- Earth styles do not feel visually distinct enough in practice.
- Background style switching is not consistently perceptible.
- Region overlays have had reliability issues.
- Click interactions need to map directly to hierarchy selection intent.

## Phase 1 — Hierarchy-First UX (P0)
### Scope
- Default entry level is `continent`.
- Selection behavior auto-advances level: `continent -> country -> state -> county -> city`.
- Keep selected path visible and reversible via clear/reset and optional step-back.
- Globe click selects nearest node at current level (if confidence threshold met).

### Success Criteria
- From initial load, user can reach city level in <= 5 selections without touching level selector.
- Path labels always match active level and selected node.
- Selecting a parent clears stale deeper-level filters.
- No dead-end selections (each selected node produces either children or an explicit “no child nodes” state).

## Phase 2 — Visual System Fidelity (P0)
### Scope
- Earth styles: `Grey`, `Blueprint`, `Atlas`, `Neon` with obvious palette/contrast differences.
- Background styles: `Deep Space`, `Black`, `Steel` with deterministic mode switching.
- Add visual regression captures for each style/background combination.

### Success Criteria
- Side-by-side screenshots are clearly distinguishable for all style modes.
- Background mode changes are visible in < 1 second after toggle.
- Style changes do not reduce overlay readability below acceptable level (labels and regions still legible).

## Phase 3 — Overlay Reliability + Semantics (P1)
### Scope
- Region polygons render consistently across all levels.
- Selected region gets a clear highlight treatment.
- Connection, flow, grouping, temperature, anchor-related, and ground heat layers remain synchronized with active hierarchy scope.

### Success Criteria
- Region outlines render for >= 99% of selections with available geometry.
- Layer toggles always reflect on-screen state in the same frame update.
- No orphan overlays from prior selections after scope changes.

## Phase 4 — Zoom-Aware Encoding (P1)
### Scope
- Point scale responds to camera distance and focus zoom.
- Overlay symbol sizes normalize across zoom to prevent overplotting at close zoom and invisibility at far zoom.
- Tune scale curves per layer type (base points vs heat vs anchor).

### Success Criteria
- Zooming in increases point legibility without overwhelming the map.
- Zooming out preserves macro-pattern visibility.
- No abrupt “popping” artifacts during wheel zoom/focus tween.

## Phase 5 — Data + Geometry Quality (P2)
### Scope
- Replace approximate region bounds with authoritative boundaries when available.
- Add geometry QA checks (ring closure, winding, validity, size thresholds).
- Track source provenance and update cadence for hierarchy/region assets.

### Success Criteria
- Boundary-to-node alignment improves significantly in spot checks.
- Geometry validation passes for all generated assets before packaging.
- Data refresh process is repeatable and delta-safe.

## Phase 6 — Instrumentation + Quality Gates (P2)
### Scope
- Add runtime diagnostics panel for mode, active level, selected path, overlay counts, render timings.
- Define guardrails for packaging: compile clean, no runtime console errors in smoke run, region assets present.
- Add scripted smoke tests for style toggle, drilldown path, and click selection.

### Success Criteria
- `npm run package:splunk` remains green with diagnostics enabled.
- Smoke script validates core user journey from load to city-level drilldown.
- Error budget: zero blocking console/runtime errors in core NEXT GEN route.

## Logical Improvements to Add
- Step-back button (`City -> County -> State ...`) with preserved focus context.
- Breadcrumb chips (click to jump to parent level directly).
- Optional “auto-drill” toggle for users who prefer manual level control.
- Child-count preview on each node card before selecting.
- “No child data” empty-state hints with suggested alternate selections.

## Delivery Milestones
- **M1 (1–2 days):** P0 hierarchy-first UX + style/background reliability.
- **M2 (2–3 days):** P1 overlay reliability + zoom-aware encoding tuning.
- **M3 (2–4 days):** P2 geometry quality + diagnostics and smoke checks.

## Definition of Done (NEXT GEN Baseline)
- Guided drilldown works end-to-end continent -> city.
- Style/background toggles produce clearly different, stable visuals.
- Region and advanced overlays update correctly at each selection.
- Zoom scaling is intuitive and does not degrade readability.
- Packaging is repeatable and smoke checks pass.
