import fs from 'node:fs'
import path from 'node:path'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true'
    args[key] = value
    if (value !== 'true') i += 1
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const variant = (args.variant || '').trim()

if (!variant) {
  throw new Error('Missing --variant (expected minimal-ui or rich-ui)')
}

const root = process.cwd()
const fromFile = path.join(root, 'starter_variants', variant, 'src', 'App.tsx')
const toFile = path.join(root, 'src', 'App.tsx')

if (!fs.existsSync(fromFile)) {
  throw new Error(`Variant file not found: ${fromFile}`)
}

fs.copyFileSync(fromFile, toFile)
console.log(`Applied variant '${variant}' to src/App.tsx`)
