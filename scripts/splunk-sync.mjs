import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(process.cwd())
const distDir = path.join(projectRoot, 'dist-splunk')

const appFolderName = 'splunk_terminal_app'
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

copyFile(path.join(distDir, 'splunk_terminal_app.js'), path.join(staticDir, 'splunk_terminal_app.js'))
copyFile(path.join(distDir, 'splunk_terminal_app.css'), path.join(staticDir, 'splunk_terminal_app.css'))

console.log(`Synced Splunk static assets to: ${staticDir}`)
