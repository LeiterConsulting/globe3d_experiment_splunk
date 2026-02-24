import fs from 'node:fs'
import path from 'node:path'

function readArg(name) {
  const idx = process.argv.indexOf(name)
  if (idx < 0 || idx + 1 >= process.argv.length) return ''
  return String(process.argv[idx + 1] || '').trim()
}

const projectRoot = path.resolve(process.cwd())
const distDir = path.join(projectRoot, 'dist-splunk')

const appFolderName = readArg('--appId') || process.env.SPLUNK_APP_ID || 'splunk_globe_app_v2'
const splunkAppRoot = path.join(projectRoot, 'splunk_app', appFolderName)
const staticDir = path.join(splunkAppRoot, 'appserver', 'static')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
}

function cleanOldAssets() {
  if (!fs.existsSync(staticDir)) return
  for (const file of fs.readdirSync(staticDir)) {
    if (file.endsWith('.js') || file.endsWith('.css')) {
      fs.rmSync(path.join(staticDir, file), { force: true })
    }
  }
}

if (!fs.existsSync(distDir)) {
  throw new Error(`Missing ${distDir}. Run "npm run build:splunk" first.`)
}

ensureDir(staticDir)
cleanOldAssets()

copyFile(path.join(distDir, `${appFolderName}.js`), path.join(staticDir, `${appFolderName}.js`))
copyFile(path.join(distDir, `${appFolderName}.css`), path.join(staticDir, `${appFolderName}.css`))

console.log(`Synced Splunk static assets to: ${staticDir}`)
