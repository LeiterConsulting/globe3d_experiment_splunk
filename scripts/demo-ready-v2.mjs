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

const startedAt = new Date().toISOString()
console.log(`[demo:ready] started at ${startedAt}`)

run('npm', ['run', 'data:orbital:build'])
run('npm', ['run', 'nasa:q1:readiness'])

const finishedAt = new Date().toISOString()
console.log(`[demo:ready] complete at ${finishedAt}`)
console.log('[demo:ready] install package: build/splunk_globe_app_v2.tar.gz')
console.log('[demo:ready] readiness report: docs/reports/nasa-q1-readiness-v2.md')
