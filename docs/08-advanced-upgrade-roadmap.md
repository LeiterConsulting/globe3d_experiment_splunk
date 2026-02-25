# Advanced Globe Upgrade Roadmap

This roadmap defines the next implementation waves for production-grade navigation, cartography, and interaction quality.

## Current baseline

Already in place:

- Region drilldown with hierarchy focus (`continent -> country -> state -> county -> city`)
- Authority-first boundaries with fallbacks and quality metadata
- Deep-zoom visual references (graticule, starfield, focus anchor)
- Location search constrained to known locations from loaded dataset
- Auto-rotation controls with level-aware damping and post-focus hold
- Great-circle arc rendering with directional arc-head markers
- Arc filtering controls (scope + grouping) and top-N control via max links
- County-line overlay pass plus tiered city indicators (core + halo)
- Cross-level unresolved/fallback quality reporting with JSON/CSV export
- Embed performance instrumentation (render timing) and boundary densification cache

## Phase 1 — Search and navigation completion (short term)

## Scope

- Add search result chips grouped by level (country/state/county/city)
- Keyboard navigation (`ArrowUp/ArrowDown/Enter`) for search suggestions
- “Pin location” mode to keep focus locked while timeline animates
- “Recent locations” list for analyst workflows

## Acceptance criteria

- Search never proposes unknown locations
- Selecting a result updates path filters and camera focus in one action
- Focused location remains readable during autoplay
- Navigation is operable entirely with keyboard

## Phase 2 — Zoom-level render awareness (medium term)

## Scope

- Render policy per level:
  - Continent/Country: broad outlines, minimal markers
  - State: state boundaries + key city indicators
  - County: county boundaries + city dots + labels for top N by value
  - City: city indicators + parent county/state context outlines
- Dynamic style scaling by camera distance:
  - boundary opacity/line width
  - marker size
  - label density

## Acceptance criteria

- No level appears visually “empty” after focus
- Parent context remains visible at county/city level
- Marker and line density remain stable (no sudden pop-in/out)

## Phase 3 — Cartographic overlays and local context (medium term)

## Scope

- Add explicit county line overlay pass (separate from region hulls)
- Add city indicator styles:
  - value-scaled circles
  - selected city pulse/glow
  - optional top-city labels
- Add optional light basemap cues (coastline/land edge shell) from existing assets

## Acceptance criteria

- County boundaries are visible when focused state/county data exists
- Selected city remains visually distinct at all supported zoom distances
- Overlay cues improve orientation without clutter

## Phase 4 — True arc rendering and cross-region flows (medium term)

## Scope

- Replace straight-line connections with globe-conforming great-circle arcs
- Add weighted arc curvature and altitude by flow magnitude
- Add directionality indicators (head/tail intensity or motion)
- Add connection filtering:
  - top-N by weight
  - by group/source/category
  - intra-region vs inter-region

## Acceptance criteria

- Arcs visibly follow globe curvature
- High-weight links are distinguishable without overwhelming map
- Filtering remains interactive at target dataset size

## Phase 5 — Data and matching robustness (longer term)

## Scope

- Strengthen county/city canonicalization and alias tables
- Add confidence score and fallback provenance to all overlay entities
- Expose unresolved location report export for data curation loop

## Acceptance criteria

- Match quality metrics are available per level and exportable
- Fallback usage is explicit and auditable
- Alias updates measurably reduce unmatched entities over time

## Phase 6 — Performance + stability (continuous)

## Scope

- Introduce LOD caps by level and viewport state
- Cache generated geometries by (level, selected path)
- Move heavy geometry prep to background worker where feasible
- Add render timing telemetry and error tracking hooks

## Acceptance criteria

- Stable interaction at target point/boundary counts
- No major GC stalls during common drill workflows
- Regressions detectable through telemetry thresholds

## Engineering work breakdown (recommended order)

1. Search UX completion (keyboard, grouping, pin/recent)
2. Level policy engine for overlays and style scaling
3. Great-circle arc renderer
4. County/city data quality strengthening + reports
5. Performance instrumentation and optimization

## Suggested milestone definition

A milestone is considered done when all are true:

- Functional acceptance criteria pass
- Packaging succeeds (`npm run package:splunk`)
- Manual smoke test covers: continent -> city drilldown, search-focus, arc flows, autoplay
- Visual regression check confirms boundary/context readability at each level

## Tech demo positioning and implementation planning

For the V2 implementation-focused positioning document, see:

- `docs/09-tech-demo-implementation-plan.md`
