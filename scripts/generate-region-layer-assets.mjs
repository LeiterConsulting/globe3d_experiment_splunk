#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

function readArg(name) {
  const idx = process.argv.indexOf(name)
  if (idx < 0 || idx + 1 >= process.argv.length) return ''
  return String(process.argv[idx + 1] || '').trim()
}

const APP_ID = readArg('--appId') || process.env.SPLUNK_APP_ID || 'splunk_globe_app'
const LOOKUP_PATH = path.join('splunk_app', APP_ID, 'lookups', 'geo_points_us_eu_hierarchy.csv')
const COUNTRY_BOUNDARY_PATHS = [
  path.join('scripts', 'data', 'ne_50m_admin_0_countries.geojson'),
  path.join('scripts', 'data', 'ne_110m_admin_0_countries.geojson'),
]
const STATE_BOUNDARY_PATH = path.join('scripts', 'data', 'ne_10m_admin_1_states_provinces.geojson')
const OUT_DIRS = [
  path.join('splunk_app', APP_ID, 'lookups', 'region_layers'),
  path.join('splunk_app', APP_ID, 'appserver', 'static', 'nextgen-region-layers'),
]
const LEVELS = ['continent', 'country', 'state', 'county', 'city']

const COUNTRY_NAME_ALIASES = {
  usa: 'united states of america',
  'united states': 'united states of america',
  uk: 'united kingdom',
  'czechia': 'czech republic',
  'czech republic': 'czech republic',
  russia: 'russian federation',
}

const STATE_NAME_ALIASES = {
  'belgium|brussels region': 'belgium|brussels capital region',
  'croatia|city of zagreb': 'croatia|grad zagreb',
  'france|provence alpes cote dazur': 'france|provence alpes cote d azur',
  'romania|bucharest ilfov': 'romania|bucuresti',
  'slovakia|bratislava region': 'slovakia|bratislavsky',
  'slovakia|kosice region': 'slovakia|kosicky',
  'slovakia|zilina region': 'slovakia|zilinsky',
  'united kingdom|england': 'united kingdom|england and wales',
  'bulgaria|sofia city': 'bulgaria|grad sofiya',
  'finland|southwest finland': 'finland|finland proper',
  'greece|central macedonia': 'greece|macedonia central',
  'mexico|ciudad de mexico': 'mexico|distrito federal',
  'spain|andalusia': 'spain|andalucia',
  'spain|catalonia': 'spain|cataluna',
  'iceland|north iceland': 'iceland|nordurland eystra',
  'norway|trondelag': 'norway|sor trondelag',
}

function parseCsv(text) {
  const rows = []
  let i = 0
  let cell = ''
  let row = []
  let inQuotes = false

  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 2
        continue
      }
      if (ch === '"') {
        inQuotes = false
        i += 1
        continue
      }
      cell += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }

    if (ch === ',') {
      row.push(cell)
      cell = ''
      i += 1
      continue
    }

    if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i += 1
      continue
    }

    if (ch === '\r') {
      i += 1
      continue
    }

    cell += ch
    i += 1
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

function readLookupRows() {
  const text = fs.readFileSync(LOOKUP_PATH, 'utf8')
  const rows = parseCsv(text)
  if (!rows.length) return []

  const headers = rows[0]
  const data = []
  for (let idx = 1; idx < rows.length; idx += 1) {
    const raw = rows[idx]
    if (!raw.length || raw.every((cell) => !cell)) continue
    const item = {}
    headers.forEach((header, colIdx) => {
      item[header] = raw[colIdx] ?? ''
    })

    const lat = Number.parseFloat(item.lat)
    const lon = Number.parseFloat(item.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    data.push({
      snapshot: item.snapshot,
      continent: item.continent,
      country: item.country,
      state: item.state,
      county: item.county,
      city: item.city,
      lat,
      lon,
      value: Number.parseFloat(item.value || '0') || 0,
    })
  }

  return data
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[()'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeCountryName(value) {
  return normalizeName(value)
}

function canonicalCountryName(value) {
  const normalized = normalizeCountryName(value)
  return COUNTRY_NAME_ALIASES[normalized] || normalized
}

function stateKey(country, state) {
  return `${canonicalCountryName(country)}|${normalizeName(state)}`
}

function normalizeStateLoose(value) {
  return normalizeName(value)
    .replace(/\b(city of|region|county|district|province|state|metro|capital)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stateLooseKey(country, state) {
  return `${canonicalCountryName(country)}|${normalizeStateLoose(state)}`
}

function readCountryBoundaryIndex() {
  const sourcePath = COUNTRY_BOUNDARY_PATHS.find((candidate) => fs.existsSync(candidate))
  if (!sourcePath) {
    return { index: new Map(), source: 'none' }
  }

  const payload = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
  const features = Array.isArray(payload?.features) ? payload.features : []
  const index = new Map()

  const addKey = (key, feature) => {
    if (!key) return
    const normalized = normalizeName(key)
    if (!normalized) return
    if (!index.has(normalized)) index.set(normalized, feature)
  }

  for (const feature of features) {
    const props = feature?.properties || {}
    const geometry = feature?.geometry
    if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) continue

    addKey(props.ADMIN, feature)
    addKey(props.NAME, feature)
    addKey(props.NAME_LONG, feature)
    addKey(props.SOVEREIGNT, feature)
    addKey(props.GEOUNIT, feature)
    addKey(props.FORMAL_EN, feature)
    addKey(props.ABBREV, feature)
  }

  return { index, source: path.basename(sourcePath) }
}

function readStateBoundaryIndex() {
  if (!fs.existsSync(STATE_BOUNDARY_PATH)) {
    return { index: new Map(), source: 'none' }
  }

  const payload = JSON.parse(fs.readFileSync(STATE_BOUNDARY_PATH, 'utf8'))
  const features = Array.isArray(payload?.features) ? payload.features : []
  const index = new Map()
  const looseIndex = new Map()

  const areaScore = (feature) => {
    const value = Number(feature?.properties?.area_sqkm)
    return Number.isFinite(value) ? value : 0
  }

  const addStateKey = (country, stateName, feature) => {
    if (!country || !stateName) return
    const key = stateKey(country, stateName)
    if (!key || key === '|') return
    const current = index.get(key)
    if (!current || areaScore(feature) > areaScore(current)) {
      index.set(key, feature)
    }

    const looseKey = stateLooseKey(country, stateName)
    if (looseKey && looseKey !== '|' && !looseKey.endsWith('|')) {
      const looseCurrent = looseIndex.get(looseKey)
      if (!looseCurrent || areaScore(feature) > areaScore(looseCurrent)) {
        looseIndex.set(looseKey, feature)
      }
    }
  }

  for (const feature of features) {
    const props = feature?.properties || {}
    const geometry = feature?.geometry
    if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) continue

    const country =
      props.admin ||
      props.adm0_name ||
      props.geonunit ||
      props.sovereignt ||
      ''

    const stateCandidates = [
      props.name,
      props.name_en,
      props.name_alt,
      props.name_local,
      props.woe_name,
      props.region,
      props.region_cod,
      props.gn_name,
      props.nameascii,
      props.abbrev,
      props.postal,
    ].filter(Boolean)

    for (const candidate of stateCandidates) {
      const chunks = String(candidate).split('|').map((part) => part.trim()).filter(Boolean)
      if (!chunks.length) {
        addStateKey(country, candidate, feature)
      } else {
        for (const chunk of chunks) addStateKey(country, chunk, feature)
      }
    }
  }

  return { index, looseIndex, source: path.basename(STATE_BOUNDARY_PATH) }
}

function getCountryBoundaryFeature(countryName, countryBoundaryIndex) {
  if (!countryBoundaryIndex || countryBoundaryIndex.size === 0) return null
  const normalized = normalizeCountryName(countryName)
  const canonical = COUNTRY_NAME_ALIASES[normalized] || normalized
  return countryBoundaryIndex.get(canonical) || countryBoundaryIndex.get(normalized) || null
}

function getStateBoundaryFeature(countryName, stateName, stateBoundaryIndex, stateBoundaryLooseIndex) {
  if (!stateBoundaryIndex || stateBoundaryIndex.size === 0) return null
  const rawKey = stateKey(countryName, stateName)
  const alias = STATE_NAME_ALIASES[rawKey]
  if (alias && stateBoundaryIndex.has(alias)) return stateBoundaryIndex.get(alias)
  if (stateBoundaryIndex.has(rawKey)) return stateBoundaryIndex.get(rawKey)

  if (stateBoundaryLooseIndex && stateBoundaryLooseIndex.size > 0) {
    const looseKey = stateLooseKey(countryName, stateName)
    if (stateBoundaryLooseIndex.has(looseKey)) return stateBoundaryLooseIndex.get(looseKey)
  }

  return null
}

function pathKey(row, level) {
  const idx = LEVELS.indexOf(level)
  return LEVELS.slice(0, idx + 1).map((name) => String(row[name] || '').trim()).join('|')
}

function computeGroupStats(rows, level) {
  const groups = new Map()

  for (const row of rows) {
    const key = pathKey(row, level)
    if (!key) continue
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, {
        key,
        level,
        labels: LEVELS.reduce((acc, name) => ({ ...acc, [name]: row[name] || '' }), {}),
        count: 1,
        totalValue: row.value,
        points: [[row.lon, row.lat]],
        minLat: row.lat,
        maxLat: row.lat,
        minLon: row.lon,
        maxLon: row.lon,
        latSum: row.lat,
        lonSum: row.lon,
      })
      continue
    }

    existing.count += 1
    existing.totalValue += row.value
    existing.points.push([row.lon, row.lat])
    existing.minLat = Math.min(existing.minLat, row.lat)
    existing.maxLat = Math.max(existing.maxLat, row.lat)
    existing.minLon = Math.min(existing.minLon, row.lon)
    existing.maxLon = Math.max(existing.maxLon, row.lon)
    existing.latSum += row.lat
    existing.lonSum += row.lon
  }

  return [...groups.values()].map((group) => {
    const centerLat = group.latSum / group.count
    const centerLon = group.lonSum / group.count
    return {
      ...group,
      centerLat,
      centerLon,
      bbox: [group.minLon, group.minLat, group.maxLon, group.maxLat],
    }
  })
}

function cross(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
}

function convexHull(points) {
  const sorted = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]))
  if (sorted.length <= 1) return sorted

  const lower = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop()
    }
    lower.push(point)
  }

  const upper = []
  for (let idx = sorted.length - 1; idx >= 0; idx -= 1) {
    const point = sorted[idx]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop()
    }
    upper.push(point)
  }

  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

function centroid(points) {
  const sum = points.reduce((acc, point) => ({ lon: acc.lon + point[0], lat: acc.lat + point[1] }), { lon: 0, lat: 0 })
  return {
    lon: sum.lon / points.length,
    lat: sum.lat / points.length,
  }
}

function scaledRing(points, center, factor = 1.08) {
  return points.map((point) => {
    const lon = center.lon + (point[0] - center.lon) * factor
    const lat = center.lat + (point[1] - center.lat) * factor
    return [Number(lon.toFixed(6)), Number(lat.toFixed(6))]
  })
}

function levelPaddingFactor(level, sourcePointCount) {
  if (level === 'continent') return 1.0
  if (level === 'country') return sourcePointCount > 160 ? 1.0 : 1.01
  if (level === 'state') return 1.02
  if (level === 'county') return 1.035
  return 1.04
}

function fallbackRingFromBbox(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const lonPad = Math.max((maxLon - minLon) * 0.2, 0.08)
  const latPad = Math.max((maxLat - minLat) * 0.2, 0.08)
  const ring = [
    [minLon - lonPad, minLat - latPad],
    [maxLon + lonPad, minLat - latPad],
    [maxLon + lonPad, maxLat + latPad],
    [minLon - lonPad, maxLat + latPad],
  ]
  return [...ring, ring[0]]
}

function distance(point, center) {
  const dx = point[0] - center.lon
  const dy = point[1] - center.lat
  return Math.sqrt(dx * dx + dy * dy)
}

function bestEffortPolygon(group) {
  const rawPoints = group.points || []
  const uniquePoints = [...new Map(rawPoints.map((point) => [`${point[0].toFixed(5)}|${point[1].toFixed(5)}`, point])).values()]
  if (uniquePoints.length < 3) {
    return {
      ring: fallbackRingFromBbox(group.bbox),
      strategy: 'bbox-fallback',
      sourcePointCount: uniquePoints.length,
      hullVertexCount: 4,
      qualityScore: Number((0.2 + Math.min(0.2, uniquePoints.length * 0.08)).toFixed(3)),
    }
  }

  const center = centroid(uniquePoints)
  let points = uniquePoints
  let trimmedRatio = 0
  if (uniquePoints.length > 25) {
    const ranked = uniquePoints
      .map((point) => ({ point, d: distance(point, center) }))
      .sort((a, b) => a.d - b.d)
    const keep = Math.max(12, Math.floor(ranked.length * 0.92))
    points = ranked.slice(0, keep).map((entry) => entry.point)
    trimmedRatio = 1 - keep / ranked.length
  }

  const hull = convexHull(points)
  if (hull.length < 3) {
    return {
      ring: fallbackRingFromBbox(group.bbox),
      strategy: 'bbox-degenerate',
      sourcePointCount: uniquePoints.length,
      hullVertexCount: 4,
      qualityScore: Number((0.32 + Math.min(0.2, uniquePoints.length * 0.03)).toFixed(3)),
    }
  }

  const padded = scaledRing(hull, center, levelPaddingFactor(group.level, uniquePoints.length))
  const spreadScore = Math.min(1, hull.length / 12)
  const densityScore = Math.min(1, uniquePoints.length / 18)
  const trimPenalty = Math.min(0.25, trimmedRatio * 0.7)
  const qualityScore = Math.max(0.2, Math.min(1, 0.35 + spreadScore * 0.35 + densityScore * 0.3 - trimPenalty))

  return {
    ring: [...padded, padded[0]],
    strategy: 'convex-hull',
    sourcePointCount: uniquePoints.length,
    hullVertexCount: hull.length,
    qualityScore: Number(qualityScore.toFixed(3)),
  }
}

function bboxPolygon(bbox, padding = 0.12) {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const lonPad = Math.max((maxLon - minLon) * 0.35, padding)
  const latPad = Math.max((maxLat - minLat) * 0.35, padding)

  const a = [minLon - lonPad, minLat - latPad]
  const b = [maxLon + lonPad, minLat - latPad]
  const c = [maxLon + lonPad, maxLat + latPad]
  const d = [minLon - lonPad, maxLat + latPad]

  return [a, b, c, d, a]
}

function buildFeatureCollection(groups, level, countryBoundaryIndex, stateBoundaryIndex, stateBoundaryLooseIndex) {
  return {
    type: 'FeatureCollection',
    level,
    featureCount: groups.length,
    features: groups.map((group) => {
      if (level === 'country') {
        const countryName = String(group.labels?.country || '')
        const boundaryFeature = getCountryBoundaryFeature(countryName, countryBoundaryIndex)
        if (boundaryFeature && boundaryFeature.geometry) {
          const props = boundaryFeature.properties || {}
          return {
            type: 'Feature',
            properties: {
              key: group.key,
              level: group.level,
              labels: group.labels,
              count: group.count,
              totalValue: Number(group.totalValue.toFixed(2)),
              centerLat: Number(group.centerLat.toFixed(6)),
              centerLon: Number(group.centerLon.toFixed(6)),
              bbox: group.bbox,
              geometryStrategy: 'admin-boundary',
              sourcePointCount: group.points.length,
              hullVertexCount: 0,
              qualityScore: 0.995,
              boundarySource: 'natural-earth-110m',
              boundaryName: props.ADMIN || props.NAME || countryName,
            },
            geometry: boundaryFeature.geometry,
          }
        }
      }

      if (level === 'state') {
        const countryName = String(group.labels?.country || '')
        const stateName = String(group.labels?.state || '')
        const boundaryFeature = getStateBoundaryFeature(countryName, stateName, stateBoundaryIndex, stateBoundaryLooseIndex)
        if (boundaryFeature && boundaryFeature.geometry) {
          const props = boundaryFeature.properties || {}
          return {
            type: 'Feature',
            properties: {
              key: group.key,
              level: group.level,
              labels: group.labels,
              count: group.count,
              totalValue: Number(group.totalValue.toFixed(2)),
              centerLat: Number(group.centerLat.toFixed(6)),
              centerLon: Number(group.centerLon.toFixed(6)),
              bbox: group.bbox,
              geometryStrategy: 'admin1-boundary',
              sourcePointCount: group.points.length,
              hullVertexCount: 0,
              qualityScore: 0.99,
              boundarySource: 'natural-earth-10m-admin1',
              boundaryName: props.name || props.name_en || stateName,
            },
            geometry: boundaryFeature.geometry,
          }
        }
      }

      const polygon = bestEffortPolygon(group)
      return {
        type: 'Feature',
        properties: {
          key: group.key,
          level: group.level,
          labels: group.labels,
          count: group.count,
          totalValue: Number(group.totalValue.toFixed(2)),
          centerLat: Number(group.centerLat.toFixed(6)),
          centerLon: Number(group.centerLon.toFixed(6)),
          bbox: group.bbox,
          geometryStrategy: polygon.strategy,
          sourcePointCount: polygon.sourcePointCount,
          hullVertexCount: polygon.hullVertexCount,
          qualityScore: polygon.qualityScore,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [polygon.ring],
        },
      }
    }),
  }
}

function buildHierarchy(groupsByLevel) {
  const indexByKey = {}
  for (const level of LEVELS) {
    indexByKey[level] = new Map(groupsByLevel[level].map((group) => [group.key, group]))
  }

  const hierarchy = []
  for (const level of LEVELS) {
    const levelIdx = LEVELS.indexOf(level)
    const parentLevel = levelIdx > 0 ? LEVELS[levelIdx - 1] : null

    for (const group of groupsByLevel[level]) {
      const parts = group.key.split('|')
      const parentKey = parentLevel ? parts.slice(0, levelIdx).join('|') : null
      hierarchy.push({
        key: group.key,
        level,
        parentKey,
        label: parts[levelIdx] || '(unknown)',
        count: group.count,
        totalValue: Number(group.totalValue.toFixed(2)),
        center: [Number(group.centerLon.toFixed(6)), Number(group.centerLat.toFixed(6))],
        bbox: group.bbox,
      })
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    levels: LEVELS,
    nodeCount: hierarchy.length,
    nodes: hierarchy,
  }
}

function main() {
  const rows = readLookupRows()
  const { index: countryBoundaryIndex, source: countryBoundarySource } = readCountryBoundaryIndex()
  const { index: stateBoundaryIndex, looseIndex: stateBoundaryLooseIndex, source: stateBoundarySource } = readStateBoundaryIndex()
  const countryMatchStats = { matched: 0, fallback: 0 }
  const stateMatchStats = { matched: 0, fallback: 0 }
  for (const dir of OUT_DIRS) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const groupsByLevel = {}
  for (const level of LEVELS) {
    groupsByLevel[level] = computeGroupStats(rows, level)
    const featureCollection = buildFeatureCollection(groupsByLevel[level], level, countryBoundaryIndex, stateBoundaryIndex, stateBoundaryLooseIndex)
    if (level === 'country') {
      featureCollection.features.forEach((feature) => {
        if (feature.properties.geometryStrategy === 'admin-boundary') countryMatchStats.matched += 1
        else countryMatchStats.fallback += 1
      })
    }
    if (level === 'state') {
      featureCollection.features.forEach((feature) => {
        if (feature.properties.geometryStrategy === 'admin1-boundary') stateMatchStats.matched += 1
        else stateMatchStats.fallback += 1
      })
    }
    for (const dir of OUT_DIRS) {
      const outPath = path.join(dir, `${level}.geojson`)
      fs.writeFileSync(outPath, `${JSON.stringify(featureCollection, null, 2)}\n`, 'utf8')
    }
  }

  const hierarchy = buildHierarchy(groupsByLevel)
  for (const dir of OUT_DIRS) {
    fs.writeFileSync(path.join(dir, 'hierarchy.json'), `${JSON.stringify(hierarchy, null, 2)}\n`, 'utf8')
  }

  const summary = {
    generatedAt: hierarchy.generatedAt,
    rowCount: rows.length,
    byLevel: Object.fromEntries(LEVELS.map((level) => [level, groupsByLevel[level].length])),
  }
  for (const dir of OUT_DIRS) {
    fs.writeFileSync(path.join(dir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  }

  console.log(`Generated region layer assets in:\n- ${OUT_DIRS.join('\n- ')}`)
  console.log(JSON.stringify(summary, null, 2))
  console.log(`Country boundary dataset: ${countryBoundarySource}`)
  console.log(`Country boundary matches: ${countryMatchStats.matched}, fallback hulls: ${countryMatchStats.fallback}`)
  console.log(`State boundary dataset: ${stateBoundarySource}`)
  console.log(`State boundary matches: ${stateMatchStats.matched}, fallback hulls: ${stateMatchStats.fallback}`)
}

main()
