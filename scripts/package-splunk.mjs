import { spawnSync } from 'node:child_process'

function readArg(name) {
  const idx = process.argv.indexOf(name)
  if (idx < 0 || idx + 1 >= process.argv.length) return ''
  return String(process.argv[idx + 1] || '').trim()
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

const appId = readArg('--appId') || process.env.SPLUNK_APP_ID || 'splunk_globe_app'
const env = {
  ...process.env,
  SPLUNK_APP_ID: appId,
  VITE_SPLUNK_APP_ID: appId,
}

run('node', ['scripts/build-splunk.mjs', '--appId', appId], env)
run('node', ['scripts/splunk-sync.mjs', '--appId', appId], env)
run('node', ['scripts/splunk-package.mjs', '--appId', appId], env)

console.log(`Packaged Splunk app for appId='${appId}'.`)
