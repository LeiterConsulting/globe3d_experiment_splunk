import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(process.cwd())
const buildDir = path.join(projectRoot, 'build')
const appFolderName = 'splunk_terminal_app'
const splunkAppRoot = path.join(projectRoot, 'splunk_app', appFolderName)

fs.mkdirSync(buildDir, { recursive: true })

if (!fs.existsSync(splunkAppRoot)) {
  throw new Error(`Missing Splunk app folder at: ${splunkAppRoot}`)
}

for (const entry of fs.readdirSync(buildDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue
  if (!entry.name.toLowerCase().endsWith('.tar.gz')) continue
  fs.rmSync(path.join(buildDir, entry.name), { force: true })
}

const outTarGz = path.join(buildDir, `${appFolderName}.tar.gz`)

const result = spawnSync('tar', ['-czf', outTarGz, '-C', path.join(projectRoot, 'splunk_app'), appFolderName], {
  stdio: 'inherit',
})

if (result.status !== 0) {
  throw new Error(`tar failed with exit code ${result.status}`)
}

console.log(`Created Splunk install package: ${outTarGz}`)
