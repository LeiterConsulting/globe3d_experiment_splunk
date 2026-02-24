import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = path.resolve(process.cwd())

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

function assertExists(relativePath) {
  const fullPath = path.join(projectRoot, relativePath)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing expected file: ${relativePath}`)
  }
}

function assertFileContains(relativePath, needle) {
  const fullPath = path.join(projectRoot, relativePath)
  const content = fs.readFileSync(fullPath, 'utf8')
  if (!content.includes(needle)) {
    throw new Error(`Expected '${needle}' in ${relativePath}`)
  }
}

run('npm', ['run', 'package:splunk'])

assertExists('splunk_app/splunk_globe_app_v2')
assertExists('splunk_app/splunk_globe_app_v2/appserver/static/splunk_globe_app_v2.js')
assertExists('splunk_app/splunk_globe_app_v2/appserver/static/splunk_globe_app_v2.css')
assertExists('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html')
assertExists('splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/catalog.json')
assertExists('splunk_app/splunk_globe_app_v2/appserver/static/orbital-datasets/timeseries-latest.json')
assertExists('splunk_app/splunk_globe_app_v2/lookups/orbital_objects_seed.csv')
assertExists('build/splunk_globe_app_v2.tar.gz')
assertExists('docs/10-v2-nasa-quarter1-execution.md')
assertExists('src/nasa/layerRegistry.ts')
assertExists('src/nasa/simulatedTrajectoryAdapter.ts')

assertFileContains('src/NextGenPage.tsx', 'Operational confidence')
assertFileContains('src/NextGenPage.tsx', 'ops: {')
assertFileContains('src/NextGenPage.tsx', 'registrySummary')
assertFileContains('src/NextGenPage.tsx', 'createSimulatedTrajectoryAdapter')
assertFileContains('src/NextGenPage.tsx', 'Show non-terrestrial tracked objects')
assertFileContains('src/NextGenPage.tsx', 'nonTerrestrial: {')
assertFileContains('src/NextGenPage.tsx', 'launchEventMode')
assertFileContains('src/NextGenPage.tsx', 'datasetSummary')
assertFileContains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', 'data age:')
assertFileContains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', 'confidence overall:')
assertFileContains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', "#overlay[data-status='critical']")
assertFileContains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', 'applyOverlayStatus')
assertFileContains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', 'renderNonTerrestrial')
assertFileContains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', 'orbital objects:')
assertFileContains('splunk_app/splunk_globe_app_v2/appserver/static/nextgen-embed/index.html', 'orbital dataset:')

console.log('NASA Q1 v2 smoke passed: package + operational confidence + telemetry wiring verified.')
