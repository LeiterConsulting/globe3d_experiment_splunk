#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

function readArg(name) {
  const idx = process.argv.indexOf(name)
  if (idx < 0 || idx + 1 >= process.argv.length) return ''
  return String(process.argv[idx + 1] || '').trim()
}

const APP_ID = readArg('--appId') || process.env.SPLUNK_APP_ID || 'splunk_globe_app'
const projectRoot = path.resolve(process.cwd())
const staticDir = path.join(projectRoot, 'splunk_app', APP_ID, 'appserver', 'static', 'orbital-datasets')
const lookupDir = path.join(projectRoot, 'splunk_app', APP_ID, 'lookups')

const SOURCE_CONFIG = [
  { sourceType: 'starlink', prefix: 'Starlink', count: 36, altitudeKm: 550, confidence: 0.93, latBand: 52 },
  { sourceType: 'gps', prefix: 'GPS', count: 18, altitudeKm: 20200, confidence: 0.95, latBand: 68 },
  { sourceType: 'nasa', prefix: 'NASA', count: 14, altitudeKm: 780, confidence: 0.91, latBand: 75 },
  { sourceType: 'comms', prefix: 'COMMS', count: 20, altitudeKm: 35786, confidence: 0.88, latBand: 24 },
  { sourceType: 'tracked', prefix: 'Tracked', count: 16, altitudeKm: 1100, confidence: 0.79, latBand: 80 },
]

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function seededJitter(seed, scale) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  const frac = x - Math.floor(x)
  return (frac - 0.5) * scale
}

function buildCatalog() {
  const rows = []
  let globalIndex = 1

  for (const source of SOURCE_CONFIG) {
    for (let i = 0; i < source.count; i += 1) {
      const seed = globalIndex * 37 + i * 13
      const lat = clamp(
        Math.sin(((i + 1) / source.count) * Math.PI * 2.45 + seed * 0.001) * source.latBand + seededJitter(seed, 7),
        -82,
        82,
      )
      const lonBase = ((i * (360 / source.count)) - 180) + seededJitter(seed + 3, 24)
      const lon = ((lonBase + 540) % 360) - 180

      rows.push({
        id: `${source.sourceType}-${String(globalIndex).padStart(4, '0')}`,
        label: `${source.prefix}-${String(globalIndex).padStart(4, '0')}`,
        sourceType: source.sourceType,
        lat: Number(lat.toFixed(4)),
        lon: Number(lon.toFixed(4)),
        altitudeKm: source.altitudeKm,
        confidence: Number((source.confidence - Math.abs(seededJitter(seed + 5, 0.12))).toFixed(3)),
      })
      globalIndex += 1
    }
  }

  return rows
}

function buildTimeseriesLatest(catalogRows) {
  const now = new Date()
  const snapshot = now.toISOString()
  const phase = now.getUTCHours() * 60 + now.getUTCMinutes()

  return catalogRows
    .filter((_, idx) => idx % 2 === 0)
    .map((item, idx) => {
      const drift = ((phase + idx * 7) % 360) - 180
      const adjustedLon = ((item.lon + drift * 0.015 + 540) % 360) - 180
      const adjustedLat = clamp(item.lat + Math.sin((phase + idx * 11) * 0.01) * 0.9, -84, 84)
      return {
        ...item,
        lat: Number(adjustedLat.toFixed(4)),
        lon: Number(adjustedLon.toFixed(4)),
        snapshot,
      }
    })
}

function writeJson(fileName, payload) {
  fs.writeFileSync(path.join(staticDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function writeLookupCsv(catalogRows, timeseriesRows) {
  const filePath = path.join(lookupDir, 'orbital_objects_seed.csv')
  const headers = ['dataset', 'id', 'label', 'sourceType', 'lat', 'lon', 'altitudeKm', 'confidence', 'snapshot']
  const lines = [headers.join(',')]

  const appendRows = (dataset, rows) => {
    for (const item of rows) {
      lines.push([
        dataset,
        item.id,
        item.label,
        item.sourceType,
        item.lat,
        item.lon,
        item.altitudeKm,
        item.confidence,
        item.snapshot || '',
      ].join(','))
    }
  }

  appendRows('catalog', catalogRows)
  appendRows('timeseries-latest', timeseriesRows)

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8')
}

function main() {
  ensureDir(staticDir)
  ensureDir(lookupDir)

  const catalogRows = buildCatalog()
  const timeseriesRows = buildTimeseriesLatest(catalogRows)
  const generatedAt = new Date().toISOString()

  writeJson('catalog.json', {
    generatedAt,
    appId: APP_ID,
    objects: catalogRows,
  })

  writeJson('timeseries-latest.json', {
    generatedAt,
    appId: APP_ID,
    snapshot: generatedAt,
    objects: timeseriesRows,
  })

  writeLookupCsv(catalogRows, timeseriesRows)

  console.log(`Generated orbital datasets for ${APP_ID}`)
  console.log(`- catalog objects: ${catalogRows.length}`)
  console.log(`- timeseries-latest objects: ${timeseriesRows.length}`)
  console.log(`- static dir: ${path.relative(projectRoot, staticDir)}`)
}

main()
