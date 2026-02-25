import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = path.resolve(process.cwd())
const reportDir = path.join(projectRoot, 'docs', 'reports')
const reportPath = path.join(reportDir, 'v2-readiness-report.md')

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath))
}

function contains(relativePath, text) {
  const fullPath = path.join(projectRoot, relativePath)
  if (!fs.existsSync(fullPath)) return false
  const content = fs.readFileSync(fullPath, 'utf8')
  return content.includes(text)
}

function statusMark(ok) {
  return ok ? 'PASS' : 'FAIL'
}

run('npm', ['run', 'demo:smoke'])

const checks = [
  {
    label: 'V2 package artifact exists',
    ok: exists('build/splunk_globe_app_v2.tar.gz'),
    evidence: 'build/splunk_globe_app_v2.tar.gz',
  },
  {
    label: 'Operational confidence card exists',
    ok: contains('src/NextGenPage.tsx', 'Operational confidence'),
    evidence: 'src/NextGenPage.tsx',
  },
  {
    label: 'Per-layer provenance + registry summary wired',
    ok: contains('src/NextGenPage.tsx', 'registrySummary') && contains('src/NextGenPage.tsx', 'layerRegistryEntries'),
    evidence: 'src/NextGenPage.tsx',
  },
  {
    label: 'Pilot adapter lifecycle wired (connect/health/fetch/normalize)',
    ok: contains('src/NextGenPage.tsx', 'cycleAdapter') && contains('src/NextGenPage.tsx', 'pilotAdapter.fetch()'),
    evidence: 'src/NextGenPage.tsx',
  },
  {
    label: 'Embed stale/critical visual status treatment active',
    ok: contains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', "#overlay[data-status='critical']") && contains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', 'applyOverlayStatus'),
    evidence: 'splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html',
  },
  {
    label: 'Layer registry + simulated adapter scaffolding exists',
    ok: exists('src/nasa/layerRegistry.ts') && exists('src/nasa/simulatedTrajectoryAdapter.ts'),
    evidence: 'layerRegistry.ts and simulatedTrajectoryAdapter.ts',
  },
  {
    label: 'Orbital dataset artifacts generated for V2',
    ok:
      exists('splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/catalog.json') &&
      exists('splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/timeseries-latest.json') &&
      exists('splunk_app/splunk_globe_app_v2/lookups/orbital_objects_seed.csv'),
    evidence:
      'splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/catalog.json, splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/timeseries-latest.json, splunk_app/splunk_globe_app_v2/lookups/orbital_objects_seed.csv',
  },
  {
    label: 'Non-terrestrial + launch-event payload controls wired',
    ok:
      contains('src/NextGenPage.tsx', 'Show non-terrestrial tracked objects') &&
      contains('src/NextGenPage.tsx', 'Launch event mode') &&
      contains('src/NextGenPage.tsx', 'nonTerrestrial: {') &&
      contains('src/NextGenPage.tsx', 'launchEventMode') &&
      contains('src/NextGenPage.tsx', 'datasetSummary'),
    evidence: 'src/NextGenPage.tsx',
  },
  {
    label: 'Embed orbital rendering + launch-event legend treatment active',
    ok:
      contains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', 'renderNonTerrestrial') &&
      contains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', 'launchEventMode') &&
      contains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', 'orbital objects:') &&
      contains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', 'orbital dataset:'),
    evidence: 'splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html',
  },
]

const passed = checks.filter((item) => item.ok).length
const failed = checks.length - passed
const generatedAt = new Date().toISOString()

const riskRegister = [
  {
    id: 'R1',
    risk: 'Pilot adapter feed remains simulated and not connected to mission telemetry.',
    impact: 'High',
    mitigation: 'Implement production adapter with authenticated source and health SLOs in Q2.',
    owner: 'Platform + Data Ingest',
  },
  {
    id: 'R2',
    risk: 'Render telemetry is in-overlay only and not persisted to external observability stack.',
    impact: 'Medium',
    mitigation: 'Add telemetry sink export hooks and dashboard ingestion in next phase.',
    owner: 'Frontend + SRE',
  },
  {
    id: 'R3',
    risk: 'Confidence model remains heuristic and not calibrated against mission truth sets.',
    impact: 'High',
    mitigation: 'Define calibration dataset and run threshold tuning during ops rehearsal.',
    owner: 'Analytics + Mission Ops',
  },
  {
    id: 'R4',
    risk: 'In-Splunk validation has not yet been executed in target operational role contexts.',
    impact: 'Medium',
    mitigation: 'Run install + role-based smoke in Splunk test stack (Commander/Analyst/Watch Officer).',
    owner: 'Splunk App QA',
  },
  {
    id: 'R5',
    risk: 'Orbital launch-event mode has not yet been validated with operators under live in-Splunk load.',
    impact: 'Medium',
    mitigation: 'Run launch-mode scenario walkthrough in Splunk and collect operator acceptance notes for legend/status readability.',
    owner: 'Mission UX + Splunk App QA',
  },
]

const report = `# V2 Readiness Report\n\nGenerated: ${generatedAt}\n\n## Summary\n\n- Checks passed: ${passed}/${checks.length}\n- Overall status: ${failed === 0 ? 'READY FOR IN-SPLUNK TEST PHASE' : 'NOT READY'}\n\n## Verification Checklist\n\n${checks
  .map((item) => `- [${item.ok ? 'x' : ' '}] ${item.label} — ${statusMark(item.ok)} (${item.evidence})`)
  .join('\n')}\n\n## Risk Register\n\n| ID | Risk | Impact | Mitigation | Owner |\n| --- | --- | --- | --- | --- |\n${riskRegister
  .map((risk) => `| ${risk.id} | ${risk.risk} | ${risk.impact} | ${risk.mitigation} | ${risk.owner} |`)
  .join('\n')}\n\n## In-Splunk Acceptance Matrix (Non-Terrestrial / Launch)\n\n| Acceptance ID | Scenario | Commander | Analyst | Watch Officer | Evidence / Notes |\n| --- | --- | --- | --- | --- | --- |\n| NT-01 | Enable **Show non-terrestrial tracked objects** and verify orbital points + beams render with expected legend updates. | PENDING | PENDING | PENDING | |\n| NT-02 | Enable **Launch event mode** and verify visual emphasis, launch-specific legend/status updates, and interaction continuity. | PENDING | PENDING | PENDING | |\n| NT-03 | Disable non-terrestrial mode and verify clean fallback (orbital layers removed, core mission overlays unaffected). | PENDING | PENDING | PENDING | |\n\n## PASS/FAIL Rubric (NT Scenarios)\n\n- PASS: Scenario behavior matches expected visual and legend state with no blocking interaction defects.\n- FAIL: Missing or incorrect orbital visuals, incorrect legend or status text, or interaction breaks operator flow.\n- Evidence required: screenshot or short recording, timestamp, tester role, and issue/confirmation note.\n- Severity tags: Blocker (cannot proceed), Major (workflow degraded), Minor (cosmetic or non-blocking).\n\n## Next In-Splunk Test Phase\n\n1. Install [build/splunk_globe_app_v2.tar.gz](../../build/splunk_globe_app_v2.tar.gz) in Splunk test environment.\n2. Validate role-based access and endpoint behavior for Commander/Analyst/Watch Officer personas.\n3. Exercise drilldown + focus + overlays + telemetry status transitions under realistic data load.\n4. Validate non-terrestrial toggle and launch event mode behavior (objects, beams, legend updates) in live role sessions.\n5. Execute NT-01 through NT-03 and mark each persona result as PASS/FAIL with evidence.\n6. Capture operator feedback and threshold tuning notes into this report.\n`

fs.mkdirSync(reportDir, { recursive: true })
fs.writeFileSync(reportPath, report, 'utf8')

console.log(`Readiness report written: ${path.relative(projectRoot, reportPath)}`)
