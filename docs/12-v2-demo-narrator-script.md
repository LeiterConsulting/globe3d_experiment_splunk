# V2 Demo Narrator Script (8 Minutes)

## Audience and objective

- Audience: Ops-center stakeholders (Commander, Analyst, Watch Officer, platform leads).
- Objective: Demonstrate mission-ready operational value, trust signals, and non-terrestrial launch context in one concise flow.

## Setup before speaking

1. Install the package from `build/splunk_globe_app_v2.tar.gz` in Splunk.
2. Open the v2 app in Splunk.
3. Ensure the right-side panel is visible.
4. Start with:
   - **Show non-terrestrial tracked objects** = OFF
   - **Launch event mode** = OFF

## Narration timeline (talk track + actions)

### 0:00-0:45 — Opening context

**Say:**
"This v2 view is designed for ops-center decision support: one pane for situational awareness, data confidence, and fast mode transitions during high-tempo events."

**Do:**
- Briefly pan/zoom the globe.
- Point at confidence/provenance/telemetry status cues.

### 0:45-2:15 — Baseline operational trust

**Say:**
"Before adding launch overlays, we establish trust: data provenance, freshness, and visual state are surfaced continuously so operators know when to rely on the display."

**Do:**
- Highlight operational confidence/provenance status elements.
- Mention readiness report location: `docs/reports/nasa-q1-readiness-v2.md`.

### 2:15-4:45 — Non-terrestrial activation (NT-01)

**Say:**
"Now we layer non-terrestrial tracking for space-domain awareness while preserving the core mission picture."

**Do:**
- Toggle **Show non-terrestrial tracked objects** ON.
- Pause and point out orbital objects + beams.
- Point out legend updates (orbital count + dataset summary).

**Callout:**
- "This is dataset-backed, with controlled fallback behavior if a dataset is unavailable."

### 4:45-6:30 — Launch event emphasis (NT-02)

**Say:**
"In launch windows, operators need immediate visual emphasis without sacrificing interaction stability."

**Do:**
- Toggle **Launch event mode** ON.
- Pan/drag and perform a quick interaction to show no grab/pan regression.
- Point to launch-oriented legend/status behavior.

**Callout:**
- "The view biases attention to launch-relevant overlays while keeping telemetry guardrails visible."

### 6:30-7:30 — Controlled fallback (NT-03)

**Say:**
"We can cleanly return to baseline mission mode at any point."

**Do:**
- Toggle **Show non-terrestrial tracked objects** OFF.
- Confirm orbital overlays disappear and core overlays remain intact.

### 7:30-8:00 — Close and next phase

**Say:**
"V2 is demo-ready and packaged for install, with acceptance criteria captured per role. Next step is role-based in-Splunk execution and PASS/FAIL capture for NT-01/NT-02/NT-03."

**Do:**
- Show acceptance matrix in `docs/reports/nasa-q1-readiness-v2.md`.

## Q&A cheat responses

- **Where is confidence coming from?**
  - "Current model is heuristic and transparent; calibration against mission truth sets is the next hardening phase."
- **How do you know it’s healthy in real time?**
  - "Overlay status and telemetry thresholds are surfaced directly in the panel and embed status treatments."
- **Can this run in real Splunk workflows?**
  - "Yes—package is installable now; this demo flow is aligned with role-based acceptance capture in Splunk."

## Operator score capture reminder

During the live test, mark each role as PASS/FAIL for:

- NT-01: Non-terrestrial render + legend updates
- NT-02: Launch event mode behavior + interaction continuity
- NT-03: Clean fallback to baseline overlays
