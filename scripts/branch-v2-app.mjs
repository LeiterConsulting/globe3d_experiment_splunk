import fs from 'node:fs'
import path from 'node:path'

function readArg(name) {
  const idx = process.argv.indexOf(name)
  if (idx < 0 || idx + 1 >= process.argv.length) return ''
  return String(process.argv[idx + 1] || '').trim()
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function walkFiles(root) {
  const files = []
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    if (!dir) break
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.isFile()) {
        files.push(fullPath)
      }
    }
  }
  return files
}

function replaceInTextFiles(root, oldAppId, newAppId) {
  const textExtensions = new Set([
    '.conf',
    '.xml',
    '.py',
    '.js',
    '.mjs',
    '.ts',
    '.tsx',
    '.css',
    '.html',
    '.json',
    '.md',
    '.txt',
    '.csv',
  ])

  const files = walkFiles(root)
  let changed = 0
  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase()
    if (!textExtensions.has(ext)) continue
    const original = fs.readFileSync(filePath, 'utf8')
    if (!original.includes(oldAppId)) continue
    const updated = original.split(oldAppId).join(newAppId)
    fs.writeFileSync(filePath, updated, 'utf8')
    changed += 1
  }
  return changed
}

const projectRoot = path.resolve(process.cwd())
const oldAppId = readArg('--fromAppId') || 'splunk_globe_app'
const newAppId = readArg('--appId') || 'splunk_globe_app_v2'

if (oldAppId === newAppId) {
  throw new Error('New app ID must be different from source app ID.')
}

const sourceDir = path.join(projectRoot, 'splunk_app', oldAppId)
const targetDir = path.join(projectRoot, 'splunk_app', newAppId)

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Source app folder does not exist: ${sourceDir}`)
}

if (!fs.existsSync(targetDir)) {
  copyDir(sourceDir, targetDir)
}

const changedFiles = replaceInTextFiles(targetDir, oldAppId, newAppId)

const oldViewPath = path.join(targetDir, 'default', 'data', 'ui', 'views', `${oldAppId}.xml`)
const newViewPath = path.join(targetDir, 'default', 'data', 'ui', 'views', `${newAppId}.xml`)
if (fs.existsSync(oldViewPath) && !fs.existsSync(newViewPath)) {
  fs.renameSync(oldViewPath, newViewPath)
}

console.log(`Branched Splunk app '${oldAppId}' -> '${newAppId}'. Updated ${changedFiles} text files.`)
