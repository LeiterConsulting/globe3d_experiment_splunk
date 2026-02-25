# Changelog

All notable changes to this project are documented in this file.

## [2.0.0] - 2026-02-25

### Added

- V2-only Splunk app package under `splunk_app/splunk_globe_app_v2`.
- End-to-end demo prep command `npm run demo:ready`.
- Smoke/readiness automation with acceptance matrix and report generation.
- Orbital dataset generation pipeline and non-terrestrial visualization mode.
- Demo operator docs: run sheet and narrator script.

### Changed

- Repository scope tightened to V2-only assets and workflows.
- Documentation reframed as neutral tech-demo implementation/design guidance.
- Command surface normalized to `demo:*` naming for validation workflows.
- Build and packaging defaults standardized on `splunk_globe_app_v2`.

### Removed

- Legacy non-V2 app assets and bootstrap/template variant material.
- Aerospace-program-specific documentation framing.

---

## Release notes seed (copy/paste)

`v2.0.0` delivers a V2-only Splunk globe tech demo with dataset-backed non-terrestrial overlays, launch-event mode, confidence/provenance instrumentation, and a reproducible packaging/validation workflow. Use `npm run demo:ready` to generate the installable app package (`build/splunk_globe_app_v2.tar.gz`) and the latest readiness report (`docs/reports/v2-readiness-report.md`).
