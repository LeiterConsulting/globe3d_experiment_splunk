import { useEffect, useMemo, useRef, useState } from 'react'
import { runGeoSearch, type GeoPoint, type GeoSnapshot } from './splunkSearchClient'
import { createSimulatedTrajectoryAdapter } from './nasa/simulatedTrajectoryAdapter'
import { scoreToHealth, summarizeLayerRegistry, type LayerRegistryEntry } from './nasa/layerRegistry'

type Status = 'idle' | 'loading' | 'error'
type Level = 'continent' | 'country' | 'state' | 'county' | 'city'
type ContextTheme = 'subtle-cyan' | 'amber-contrast' | 'violet-night'

type NextGenFrame = {
  name: string
  points: Array<[number, number, number]>
}

type RegionLayerFeature = {
  type: 'Feature'
  properties: {
    key: string
    level: Level
    labels: Record<string, string>
    count: number
    totalValue: number
    geometryStrategy?: string
    sourcePointCount?: number
    hullVertexCount?: number
    qualityScore?: number
  }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: Array<Array<[number, number]>> | Array<Array<Array<[number, number]>>>
  }
}

type RegionLayerPayload = {
  level: Level
  selectedKey: string
  features: Array<{
    key: string
    label: string
    count: number
    totalValue: number
    qualityScore: number
    sourcePointCount: number
    hullVertexCount: number
    geometryStrategy: string
    paths: Array<Array<[number, number]>>
  }>
}

type ArcPayload = {
  from: [number, number]
  to: [number, number]
  weight: number
  group: string
}

type FlowVectorPayload = {
  lat: number
  lon: number
  bearing: number
  magnitude: number
}

type GroupClusterPayload = {
  key: string
  label: string
  color: string
  points: Array<[number, number, number]>
}

type TemperaturePayload = {
  coldThreshold: number
  hotThreshold: number
  points: Array<[number, number, number]>
}

type AnchorPayload = {
  key: string
  label: string
  related: Array<[number, number, number]>
}

type HeatCellPayload = {
  lat: number
  lon: number
  intensity: number
}

type OrbitalObjectPayload = {
  id: string
  label: string
  sourceType: 'starlink' | 'nasa' | 'gps' | 'comms' | 'tracked' | 'demo'
  lat: number
  lon: number
  altitudeKm: number
  confidence: number
}

type OrbitalDatasetObject = {
  id: string
  label: string
  sourceType: OrbitalObjectPayload['sourceType']
  lat: number
  lon: number
  altitudeKm: number
  confidence?: number
  snapshot?: string
}

type OpsPayload = {
  confidence: {
    region: number
    context: number
    arcs: number
    overall: number
  }
  provenance: {
    appId: string
    source: string
    frame: string
    dataRefreshedAt: string
    layersRefreshedAt: string
    activeLevel: Level
    layers: Array<{
      id: string
      label: string
      source: string
      enabled: boolean
      entityCount: number
      confidence: number
      health: 'healthy' | 'warning' | 'critical'
      updatedAt: string
      staleState: 'healthy' | 'warning' | 'critical'
    }>
    registrySummary: {
      total: number
      enabled: number
      healthy: number
      warning: number
      critical: number
    }
    pilotAdapter: {
      id: string
      source: string
      status: 'healthy' | 'warning' | 'critical'
      detail: string
      checkedAt: string
      lastFetchAt: string
      sampleCount: number
    }
  }
  telemetry: {
    dataAgeSec: number
    staleWarnSec: number
    staleCriticalSec: number
    renderWarnMs: number
    renderCriticalMs: number
  }
}

type NextGenMessage = {
  type: 'splunk-nextgen:data'
  payload: {
    title: string
    subtitle: string
    frames: NextGenFrame[]
    playback: {
      autoplay: boolean
      speedMs: number
      selectedFrame: number
    }
    view: {
      activeLevel: Level
      earthStyle: 'grey' | 'blueprint' | 'atlas' | 'neon'
      backgroundStyle: 'deep-space' | 'black' | 'steel'
      baseVisual: 'spikes' | 'dots' | 'hybrid'
      contextTheme: ContextTheme
      regionQualityDebug: boolean
      regionLowQualityOnly: boolean
      regionTriageMode: 'all' | 'low-quality' | 'bbox-fallback' | 'degenerate'
      pointIntensity: number
      pointOpacity: number
      showRegionHighlight: boolean
      showFocusLabel: boolean
      autoRotate: boolean
      autoRotateSpeed: number
      zoomScale: number
    }
    focus: {
      requestId: number
      lat: number
      lon: number
      zoomDistance: number
      label: string
    } | null
    highlights: Array<[number, number, number]>
    regionLayer: RegionLayerPayload | null
    contextLayer: RegionLayerPayload | null
    connections: {
      enabled: boolean
      arcs: ArcPayload[]
    }
    flow: {
      enabled: boolean
      vectors: FlowVectorPayload[]
    }
    grouping: {
      enabled: boolean
      clusters: GroupClusterPayload[]
    }
    temperature: {
      enabled: boolean
      layer: TemperaturePayload | null
    }
    anchor: {
      enabled: boolean
      layer: AnchorPayload | null
    }
    groundHeat: {
      enabled: boolean
      cells: HeatCellPayload[]
    }
    nonTerrestrial: {
      enabled: boolean
      objects: OrbitalObjectPayload[]
      sourceSummary: string
      launchEventMode: boolean
      datasetSummary: string
    }
    ops: OpsPayload
  }
}

type NextGenClickMessage = {
  type: 'splunk-nextgen:globe-click'
  payload: {
    lat: number
    lon: number
  }
}

type RegionNode = {
  key: string
  name: string
  level: Level
  bandLabel: string
  sourceTag: string
  categoryTag: string
  continentTag: string
  lat: number
  lon: number
  count: number
  total: number
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

type KnownLocationOption = {
  id: string
  level: Level
  key: string
  label: string
  display: string
  path: Partial<Record<Level, string>>
  lat: number
  lon: number
  count: number
  total: number
  searchText: string
}

const SPLUNK_APP_ID = (import.meta.env.VITE_SPLUNK_APP_ID as string | undefined) || 'splunk_globe_app'

function getEmbedUrl() {
  return `/static/app/${SPLUNK_APP_ID}/nextgen-embed/index.html`
}

function getRegionLayerUrl(level: Level) {
  return `/static/app/${SPLUNK_APP_ID}/nextgen-region-layers/${level}.geojson`
}

function getOrbitalDatasetUrl(fileName: string) {
  return `/static/app/${SPLUNK_APP_ID}/orbital-datasets/${fileName}`
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function continentFromLatLon(lat: number, lon: number): string {
  if (lat > 15 && lat < 75 && lon > -170 && lon < -50) return 'North America'
  if (lat < 15 && lat > -60 && lon > -90 && lon < -30) return 'South America'
  if (lat > 35 && lon > -15 && lon < 60) return 'Europe'
  if (lat > -35 && lat < 35 && lon > -20 && lon < 55) return 'Africa'
  if (lat > 5 && lon > 55 && lon < 180) return 'Asia'
  if (lat < -10 && lon > 110 && lon < 180) return 'Oceania'
  return 'Global'
}

const LEVEL_ORDER: Level[] = ['continent', 'country', 'state', 'county', 'city']

function nextLevel(level: Level): Level | null {
  const idx = LEVEL_ORDER.indexOf(level)
  if (idx < 0 || idx >= LEVEL_ORDER.length - 1) return null
  return LEVEL_ORDER[idx + 1]
}

function previousLevel(level: Level): Level | null {
  const idx = LEVEL_ORDER.indexOf(level)
  if (idx <= 0) return null
  return LEVEL_ORDER[idx - 1]
}

function trimPathThroughLevel(path: Partial<Record<Level, string>>, level: Level): Partial<Record<Level, string>> {
  const idx = LEVEL_ORDER.indexOf(level)
  if (idx < 0) return {}
  const next: Partial<Record<Level, string>> = {}
  for (let i = 0; i <= idx; i += 1) {
    const key = LEVEL_ORDER[i]
    if (path[key]) next[key] = path[key]
  }
  return next
}

function parentLevels(level: Level): Level[] {
  const idx = LEVEL_ORDER.indexOf(level)
  return idx <= 0 ? [] : LEVEL_ORDER.slice(0, idx)
}

function labelOrFallback(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? '').trim()
  return trimmed || fallback
}

function normalizeLabel(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function labelsMatch(left: string | undefined, right: string | undefined): boolean {
  const a = normalizeLabel(left ?? '')
  const b = normalizeLabel(right ?? '')
  if (!a || !b) return false
  return a === b
}

function dominantLabel(counts: Map<string, number>, fallback = 'unknown') {
  let best = fallback
  let bestCount = -1
  counts.forEach((count, label) => {
    if (count > bestCount) {
      best = label
      bestCount = count
    }
  })
  return best
}

function levelValue(point: GeoPoint, level: Level): string {
  const continent = labelOrFallback(point.continent, continentFromLatLon(point.lat, point.lon))
  const country = labelOrFallback(point.country, (point.source ?? '').trim() || `${continent}-country`)
  const state = labelOrFallback(point.state, (point.category ?? '').trim() || `${country}-state`)
  const county = labelOrFallback(point.county, `${state}-county`)
  const city = labelOrFallback(point.city, (point.label ?? '').trim() || `${county}-city`)

  if (level === 'continent') return continent
  if (level === 'country') return country
  if (level === 'state') return state
  if (level === 'county') return county
  return city
}

function levelKey(point: GeoPoint, level: Level): string {
  return levelValue(point, level)
}

function normalizeSnapshots(snapshots: GeoSnapshot[], minValue: number): GeoSnapshot[] {
  return snapshots
    .map((snapshot) => ({
      name: snapshot.name,
      points: snapshot.points.filter((point) => point.value >= minValue),
    }))
    .filter((snapshot) => snapshot.points.length > 0)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function parseTimestamp(value: string): number | null {
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? ts : null
}

function formatTimestamp(value: string): string {
  const parsed = parseTimestamp(value)
  if (parsed == null) return 'n/a'
  return new Date(parsed).toLocaleString()
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

function thresholdState(value: number, warn: number, critical: number): 'healthy' | 'warning' | 'critical' {
  if (value >= critical) return 'critical'
  if (value >= warn) return 'warning'
  return 'healthy'
}

function confidenceState(value: number): 'healthy' | 'warning' | 'critical' {
  if (value < 0.55) return 'critical'
  if (value < 0.75) return 'warning'
  return 'healthy'
}

function angularDistanceScore(latA: number, lonA: number, latB: number, lonB: number): number {
  const toRad = Math.PI / 180
  const aLat = latA * toRad
  const aLon = lonA * toRad
  const bLat = latB * toRad
  const bLon = lonB * toRad
  const x = Math.sin(aLat) * Math.sin(bLat) + Math.cos(aLat) * Math.cos(bLat) * Math.cos(aLon - bLon)
  return 1 - clamp(x, -1, 1)
}

const GROUP_COLORS = ['#38bdf8', '#22d3ee', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#f87171', '#60a5fa']

const DEMO_ORBITAL_OBJECTS: OrbitalObjectPayload[] = [
  { id: 'starlink-1451', label: 'Starlink-1451', sourceType: 'starlink', lat: 44.8, lon: -118.4, altitudeKm: 550, confidence: 0.92 },
  { id: 'starlink-2330', label: 'Starlink-2330', sourceType: 'starlink', lat: 12.6, lon: 81.2, altitudeKm: 550, confidence: 0.91 },
  { id: 'starlink-4112', label: 'Starlink-4112', sourceType: 'starlink', lat: -24.4, lon: 22.6, altitudeKm: 550, confidence: 0.9 },
  { id: 'gps-iif-08', label: 'GPS IIF-08', sourceType: 'gps', lat: 18.1, lon: -61.2, altitudeKm: 20200, confidence: 0.95 },
  { id: 'gps-iii-06', label: 'GPS III-06', sourceType: 'gps', lat: -11.2, lon: 115.8, altitudeKm: 20200, confidence: 0.95 },
  { id: 'nasa-tdrs-12', label: 'NASA TDRS-12', sourceType: 'nasa', lat: 0.3, lon: -41.0, altitudeKm: 35786, confidence: 0.93 },
  { id: 'nasa-landsat-9', label: 'Landsat-9', sourceType: 'nasa', lat: 57.6, lon: 73.4, altitudeKm: 705, confidence: 0.9 },
  { id: 'comms-eutelsat', label: 'Eutelsat Comms', sourceType: 'comms', lat: -1.2, lon: 9.7, altitudeKm: 35786, confidence: 0.88 },
  { id: 'tracked-debris-02', label: 'Tracked Object-02', sourceType: 'tracked', lat: 31.8, lon: 142.4, altitudeKm: 980, confidence: 0.74 },
]

function inferOrbitalSourceType(value: string): OrbitalObjectPayload['sourceType'] {
  const text = normalizeLabel(value)
  if (text.includes('starlink')) return 'starlink'
  if (text.includes('nasa') || text.includes('tdrs') || text.includes('landsat')) return 'nasa'
  if (text.includes('gps') || text.includes('gnss')) return 'gps'
  if (text.includes('comms') || text.includes('comm') || text.includes('satcom')) return 'comms'
  if (text.includes('tracked') || text.includes('object') || text.includes('debris') || text.includes('sat')) return 'tracked'
  return 'demo'
}

function sourceAltitudeKm(sourceType: OrbitalObjectPayload['sourceType']): number {
  if (sourceType === 'starlink') return 550
  if (sourceType === 'gps') return 20200
  if (sourceType === 'comms') return 35786
  if (sourceType === 'nasa') return 820
  if (sourceType === 'tracked') return 1200
  return 650
}

function normalizeOrbitalDatasetItem(raw: unknown, fallbackId: number): OrbitalDatasetObject | null {
  if (!isObjectRecord(raw)) return null
  const lat = Number(raw.lat)
  const lon = Number(raw.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  const label = String(raw.label ?? raw.name ?? '').trim() || `Tracked object ${fallbackId}`
  const inferredType = inferOrbitalSourceType(`${raw.sourceType ?? ''} ${label}`)
  const sourceType = inferredType === 'demo' ? 'tracked' : inferredType
  const altitudeKm = Number(raw.altitudeKm)
  const confidence = Number(raw.confidence)
  const snapshot = String(raw.snapshot ?? '').trim()

  return {
    id: String(raw.id ?? `dataset-${fallbackId}`).trim() || `dataset-${fallbackId}`,
    label,
    sourceType,
    lat,
    lon,
    altitudeKm: Number.isFinite(altitudeKm) ? altitudeKm : sourceAltitudeKm(sourceType),
    confidence: Number.isFinite(confidence) ? clamp(confidence, 0.35, 0.99) : undefined,
    snapshot: snapshot || undefined,
  }
}

function parseOrbitalDatasetObjects(payload: unknown): OrbitalDatasetObject[] {
  const list = Array.isArray(payload)
    ? payload
    : isObjectRecord(payload) && Array.isArray(payload.objects)
      ? payload.objects
      : []

  const items: OrbitalDatasetObject[] = []
  for (let idx = 0; idx < list.length; idx += 1) {
    const parsed = normalizeOrbitalDatasetItem(list[idx], idx + 1)
    if (parsed) items.push(parsed)
  }
  return items
}

function hashString(value: string): number {
  let hash = 0
  for (let idx = 0; idx < value.length; idx += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(idx)
    hash |= 0
  }
  return Math.abs(hash)
}

function groupLabel(point: GeoPoint, mode: 'source' | 'category' | 'continent') {
  if (mode === 'source') return labelOrFallback(point.source, 'Unknown source')
  if (mode === 'category') return labelOrFallback(point.category, 'Unknown category')
  return labelOrFallback(point.continent, continentFromLatLon(point.lat, point.lon))
}

function buildHeatCells(points: GeoPoint[], maxCells: number): HeatCellPayload[] {
  const bins = new Map<string, { latSum: number; lonSum: number; total: number; count: number }>()
  points.forEach((point) => {
    const latBucket = Math.round(point.lat * 2) / 2
    const lonBucket = Math.round(point.lon * 2) / 2
    const key = `${latBucket}|${lonBucket}`
    const existing = bins.get(key)
    if (!existing) {
      bins.set(key, { latSum: point.lat, lonSum: point.lon, total: point.value, count: 1 })
      return
    }
    existing.latSum += point.lat
    existing.lonSum += point.lon
    existing.total += point.value
    existing.count += 1
  })

  const cells = [...bins.values()].map((entry) => ({
    lat: entry.latSum / entry.count,
    lon: entry.lonSum / entry.count,
    intensity: entry.total,
  }))

  const maxIntensity = cells.reduce((acc, cell) => Math.max(acc, cell.intensity), 0) || 1
  return cells
    .map((cell) => ({ ...cell, intensity: clamp(cell.intensity / maxIntensity, 0.08, 1) }))
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, maxCells)
}

function normalizeFeaturePaths(feature: RegionLayerFeature): Array<Array<[number, number]>> {
  const geometry = feature.geometry
  if (!geometry || !Array.isArray(geometry.coordinates)) return []

  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as Array<Array<[number, number]>>)
      .map((ring) => ring.map((coord) => [Number(coord[0]), Number(coord[1])] as [number, number]))
      .filter((ring) => ring.length >= 2)
  }

  const polygons = geometry.coordinates as Array<Array<Array<[number, number]>>>
  const paths: Array<Array<[number, number]>> = []
  polygons.forEach((polygon) => {
    polygon.forEach((ring) => {
      const mapped = ring.map((coord) => [Number(coord[0]), Number(coord[1])] as [number, number])
      if (mapped.length >= 2) paths.push(mapped)
    })
  })
  return paths
}

function toCsvCell(value: string | number | boolean): string {
  const text = String(value)
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export default function NextGenPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')
  const [iframeReady, setIframeReady] = useState(false)

  const [snapshots, setSnapshots] = useState<GeoSnapshot[]>([])
  const [autoplay, setAutoplay] = useState(true)
  const [speedMs, setSpeedMs] = useState(1300)
  const [selectedFrame, setSelectedFrame] = useState(0)

  const [minValue, setMinValue] = useState(0)
  const [pointIntensity, setPointIntensity] = useState(1)
  const [pointOpacity, setPointOpacity] = useState(0.95)

  const [earthStyle, setEarthStyle] = useState<'grey' | 'blueprint' | 'atlas' | 'neon'>('grey')
  const [backgroundStyle, setBackgroundStyle] = useState<'deep-space' | 'black' | 'steel'>('deep-space')
  const [baseVisual, setBaseVisual] = useState<'spikes' | 'dots' | 'hybrid'>('hybrid')
  const [contextTheme, setContextTheme] = useState<ContextTheme>('subtle-cyan')
  const [showContextLayer, setShowContextLayer] = useState(true)
  const [showRegionHighlight, setShowRegionHighlight] = useState(true)
  const [showRegionQualityDebug, setShowRegionQualityDebug] = useState(false)
  const [showOnlyLowQualityRegions, setShowOnlyLowQualityRegions] = useState(false)
  const [regionTriageMode, setRegionTriageMode] = useState<'all' | 'low-quality' | 'bbox-fallback' | 'degenerate'>('all')
  const [showFocusLabel, setShowFocusLabel] = useState(true)
  const [autoRotate, setAutoRotate] = useState(false)
  const [autoRotateSpeed, setAutoRotateSpeed] = useState(0.06)
  const [showConnections, setShowConnections] = useState(true)
  const [connectionMode, setConnectionMode] = useState<'hub' | 'sequential'>('hub')
  const [connectionScope, setConnectionScope] = useState<'all' | 'intra-region' | 'inter-region'>('all')
  const [connectionGroupFilter, setConnectionGroupFilter] = useState<'none' | 'source' | 'category' | 'continent'>('none')
  const [maxConnections, setMaxConnections] = useState(8)
  const [showFlow, setShowFlow] = useState(true)
  const [showGrouping, setShowGrouping] = useState(true)
  const [groupMode, setGroupMode] = useState<'source' | 'category' | 'continent'>('source')
  const [showTemperature, setShowTemperature] = useState(true)
  const [coldThreshold, setColdThreshold] = useState(0.28)
  const [hotThreshold, setHotThreshold] = useState(0.72)
  const [showAnchorRelated, setShowAnchorRelated] = useState(true)
  const [showGroundHeat, setShowGroundHeat] = useState(true)
  const [showNonTerrestrial, setShowNonTerrestrial] = useState(false)
  const [launchEventMode, setLaunchEventMode] = useState(false)
  const [settingsCollapsed, setSettingsCollapsed] = useState(false)
  const [fullView, setFullView] = useState(false)
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 980))

  const [activeLevel, setActiveLevel] = useState<Level>('continent')
  const [selectedPath, setSelectedPath] = useState<Partial<Record<Level, string>>>({})
  const [activeNodeKey, setActiveNodeKey] = useState('')
  const [focusRequestId, setFocusRequestId] = useState(0)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSelectionId, setLocationSelectionId] = useState('')
  const [regionLayerByLevel, setRegionLayerByLevel] = useState<Partial<Record<Level, RegionLayerFeature[]>>>({})
  const [dataRefreshedAt, setDataRefreshedAt] = useState(() => new Date().toISOString())
  const [layersRefreshedAt, setLayersRefreshedAt] = useState(() => new Date().toISOString())
  const [orbitalCatalog, setOrbitalCatalog] = useState<OrbitalDatasetObject[]>([])
  const [orbitalTimeseries, setOrbitalTimeseries] = useState<OrbitalDatasetObject[]>([])
  const [pilotAdapterStatus, setPilotAdapterStatus] = useState<'healthy' | 'warning' | 'critical'>('warning')
  const [pilotAdapterDetail, setPilotAdapterDetail] = useState('Initializing adapter...')
  const [pilotAdapterCheckedAt, setPilotAdapterCheckedAt] = useState(() => new Date().toISOString())
  const [pilotAdapterLastFetchAt, setPilotAdapterLastFetchAt] = useState('')
  const [pilotAdapterSampleCount, setPilotAdapterSampleCount] = useState(0)

  const pilotAdapter = useMemo(() => createSimulatedTrajectoryAdapter(), [])

  const filteredSnapshots = useMemo(() => normalizeSnapshots(snapshots, minValue), [snapshots, minValue])

  const selectedFrameClamped = useMemo(() => {
    if (!filteredSnapshots.length) return 0
    return clamp(selectedFrame, 0, filteredSnapshots.length - 1)
  }, [filteredSnapshots.length, selectedFrame])

  const currentFrame = useMemo(() => {
    if (!filteredSnapshots.length) return null
    return filteredSnapshots[selectedFrameClamped]
  }, [filteredSnapshots, selectedFrameClamped])

  const hierarchyNodes = useMemo(() => {
    if (!currentFrame) return [] as RegionNode[]

    const parent = parentLevels(activeLevel)
    const scoped = currentFrame.points.filter((point) => {
      return parent.every((level) => {
        const expected = selectedPath[level]
        if (!expected) return true
        return levelValue(point, level) === expected
      })
    })

    const bandLevel = previousLevel(activeLevel)
    const buckets = new Map<string, {
      name: string
      count: number
      total: number
      latSum: number
      lonSum: number
      minLat: number
      maxLat: number
      minLon: number
      maxLon: number
      bandCounts: Map<string, number>
      sourceCounts: Map<string, number>
      categoryCounts: Map<string, number>
      continentCounts: Map<string, number>
    }>()
    scoped.forEach((point) => {
      const key = levelKey(point, activeLevel)
      const bandLabel = bandLevel ? levelValue(point, bandLevel) : levelValue(point, activeLevel)
      const sourceLabel = labelOrFallback(point.source, 'unknown')
      const categoryLabel = labelOrFallback(point.category, 'unknown')
      const continentLabel = labelOrFallback(point.continent, continentFromLatLon(point.lat, point.lon))
      const existing = buckets.get(key)
      if (!existing) {
        const bandCounts = new Map<string, number>()
        const sourceCounts = new Map<string, number>()
        const categoryCounts = new Map<string, number>()
        const continentCounts = new Map<string, number>()
        bandCounts.set(bandLabel, 1)
        sourceCounts.set(sourceLabel, 1)
        categoryCounts.set(categoryLabel, 1)
        continentCounts.set(continentLabel, 1)
        buckets.set(key, {
          name: key,
          count: 1,
          total: point.value,
          latSum: point.lat,
          lonSum: point.lon,
          minLat: point.lat,
          maxLat: point.lat,
          minLon: point.lon,
          maxLon: point.lon,
          bandCounts,
          sourceCounts,
          categoryCounts,
          continentCounts,
        })
        return
      }
      existing.count += 1
      existing.total += point.value
      existing.latSum += point.lat
      existing.lonSum += point.lon
      existing.minLat = Math.min(existing.minLat, point.lat)
      existing.maxLat = Math.max(existing.maxLat, point.lat)
      existing.minLon = Math.min(existing.minLon, point.lon)
      existing.maxLon = Math.max(existing.maxLon, point.lon)
      existing.bandCounts.set(bandLabel, (existing.bandCounts.get(bandLabel) || 0) + 1)
      existing.sourceCounts.set(sourceLabel, (existing.sourceCounts.get(sourceLabel) || 0) + 1)
      existing.categoryCounts.set(categoryLabel, (existing.categoryCounts.get(categoryLabel) || 0) + 1)
      existing.continentCounts.set(continentLabel, (existing.continentCounts.get(continentLabel) || 0) + 1)
    })

    return [...buckets.entries()]
      .map(([key, value]) => ({
        key,
        name: value.name,
        level: activeLevel,
        bandLabel: dominantLabel(value.bandCounts, value.name),
        sourceTag: dominantLabel(value.sourceCounts),
        categoryTag: dominantLabel(value.categoryCounts),
        continentTag: dominantLabel(value.continentCounts),
        lat: value.latSum / value.count,
        lon: value.lonSum / value.count,
        count: value.count,
        total: value.total,
        minLat: value.minLat,
        maxLat: value.maxLat,
        minLon: value.minLon,
        maxLon: value.maxLon,
      }))
      .sort((a, b) => b.total - a.total)
  }, [currentFrame, activeLevel, selectedPath])

  useEffect(() => {
    setActiveNodeKey(selectedPath[activeLevel] ?? '')
  }, [activeLevel, selectedPath])

  useEffect(() => {
    if (!hierarchyNodes.length) {
      setActiveNodeKey('')
      return
    }
    if (activeNodeKey && hierarchyNodes.some((node) => node.key === activeNodeKey)) return
    setActiveNodeKey(hierarchyNodes[0].key)
  }, [hierarchyNodes, activeNodeKey])

  const selectedNode = useMemo(() => hierarchyNodes.find((node) => node.key === activeNodeKey) ?? null, [hierarchyNodes, activeNodeKey])

  const selectedTrail = useMemo(() => {
    return LEVEL_ORDER.filter((level) => selectedPath[level]).map((level) => ({ level, label: selectedPath[level] as string }))
  }, [selectedPath])

  const knownLocations = useMemo<KnownLocationOption[]>(() => {
    const points = filteredSnapshots.flatMap((snapshot) => snapshot.points)
    const buckets = new Map<string, KnownLocationOption & { latSum: number; lonSum: number }>()

    points.forEach((point) => {
      const path: Partial<Record<Level, string>> = {
        continent: levelValue(point, 'continent'),
        country: levelValue(point, 'country'),
        state: levelValue(point, 'state'),
        county: levelValue(point, 'county'),
        city: levelValue(point, 'city'),
      }

      LEVEL_ORDER.forEach((level) => {
        const key = path[level] || ''
        if (!key) return
        const id = `${level}::${key}`
        const existing = buckets.get(id)
        if (!existing) {
          const display = `${key} (${level})`
          buckets.set(id, {
            id,
            level,
            key,
            label: key,
            display,
            path: trimPathThroughLevel(path, level),
            lat: point.lat,
            lon: point.lon,
            count: 1,
            total: point.value,
            searchText: normalizeLabel(`${display} ${path.continent || ''} ${path.country || ''} ${path.state || ''}`),
            latSum: point.lat,
            lonSum: point.lon,
          })
          return
        }
        existing.count += 1
        existing.total += point.value
        existing.latSum += point.lat
        existing.lonSum += point.lon
      })
    })

    const activeIdx = LEVEL_ORDER.indexOf(activeLevel)
    return [...buckets.values()]
      .map((entry) => ({
        id: entry.id,
        level: entry.level,
        key: entry.key,
        label: entry.label,
        display: entry.display,
        path: entry.path,
        lat: entry.latSum / entry.count,
        lon: entry.lonSum / entry.count,
        count: entry.count,
        total: entry.total,
        searchText: entry.searchText,
      }))
      .sort((left, right) => {
        const leftDist = Math.abs(LEVEL_ORDER.indexOf(left.level) - activeIdx)
        const rightDist = Math.abs(LEVEL_ORDER.indexOf(right.level) - activeIdx)
        if (leftDist !== rightDist) return leftDist - rightDist
        return right.total - left.total
      })
  }, [filteredSnapshots, activeLevel])

  const filteredLocationOptions = useMemo(() => {
    const query = normalizeLabel(locationQuery)
    const filtered = query
      ? knownLocations.filter((option) => option.searchText.includes(query))
      : knownLocations
    return filtered.slice(0, 120)
  }, [knownLocations, locationQuery])

  const knownLocationById = useMemo(() => {
    return knownLocations.reduce((acc, option) => {
      acc.set(option.id, option)
      return acc
    }, new Map<string, KnownLocationOption>())
  }, [knownLocations])

  const knownLocationByDisplay = useMemo(() => {
    return knownLocations.reduce((acc, option) => {
      acc.set(option.display, option)
      return acc
    }, new Map<string, KnownLocationOption>())
  }, [knownLocations])

  const focusKnownLocation = (option: KnownLocationOption | null) => {
    if (!option) return
    setSelectedPath(option.path)
    setActiveLevel(option.level)
    setActiveNodeKey(option.key)
    setLocationSelectionId(option.id)
    setLocationQuery(option.display)
    setFocusRequestId((prev) => prev + 1)
  }

  const selectNodeAndDrill = (node: RegionNode) => {
    setActiveNodeKey(node.key)
    setSelectedPath((prev) => {
      const next: Partial<Record<Level, string>> = { ...prev, [activeLevel]: node.key }
      const idx = LEVEL_ORDER.indexOf(activeLevel)
      for (let i = idx + 1; i < LEVEL_ORDER.length; i += 1) {
        delete next[LEVEL_ORDER[i]]
      }
      return next
    })
    setFocusRequestId((prev) => prev + 1)
    const next = nextLevel(activeLevel)
    if (next) {
      setActiveLevel(next)
      setActiveNodeKey('')
    }
  }

  const stepBackOneLevel = () => {
    const idx = LEVEL_ORDER.indexOf(activeLevel)
    if (idx <= 0) return
    const previousLevel = LEVEL_ORDER[idx - 1]
    setSelectedPath((prev) => {
      const next = { ...prev }
      for (let i = idx - 1; i < LEVEL_ORDER.length; i += 1) {
        delete next[LEVEL_ORDER[i]]
      }
      return next
    })
    setActiveLevel(previousLevel)
    setActiveNodeKey('')
  }

  const resetDrilldown = () => {
    setSelectedPath({})
    setActiveNodeKey('')
    setActiveLevel('continent')
    setFocusRequestId((prev) => prev + 1)
  }

  const jumpToTrailLevel = (level: Level) => {
    setSelectedPath((prev) => trimPathThroughLevel(prev, level))
    const next = nextLevel(level)
    setActiveLevel(next ?? level)
    setActiveNodeKey('')
    setFocusRequestId((prev) => prev + 1)
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const tag = (target?.tagName || '').toLowerCase()
      const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(target?.isContentEditable)
      if (isEditable) return

      if (event.key === 'Backspace') {
        if (LEVEL_ORDER.indexOf(activeLevel) <= 0) return
        event.preventDefault()
        stepBackOneLevel()
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        resetDrilldown()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeLevel])

  useEffect(() => {
    function onResize() {
      setViewportHeight(window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!fullView) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [fullView])

  useEffect(() => {
    let cancelled = false
    let connected = false

    async function cycleAdapter() {
      try {
        if (!connected) {
          await pilotAdapter.connect()
          connected = true
        }

        const health = await pilotAdapter.health()
        if (cancelled) return
        setPilotAdapterStatus(health.status)
        setPilotAdapterDetail(health.detail || 'Adapter health check OK')
        setPilotAdapterCheckedAt(health.checkedAt || new Date().toISOString())

        const feed = await pilotAdapter.fetch()
        const normalized = pilotAdapter.normalize(feed)
        if (cancelled) return
        const sampleCount = Array.isArray(normalized) ? normalized.length : 0
        setPilotAdapterSampleCount(sampleCount)
        setPilotAdapterLastFetchAt(new Date().toISOString())
      } catch (error) {
        if (cancelled) return
        setPilotAdapterStatus('critical')
        setPilotAdapterDetail(error instanceof Error ? error.message : String(error))
        setPilotAdapterCheckedAt(new Date().toISOString())
      }
    }

    void cycleAdapter()
    const timer = window.setInterval(() => {
      void cycleAdapter()
    }, 90_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [pilotAdapter])

  const filteredByNode = useMemo(() => {
    const hasAnyPath = LEVEL_ORDER.some((level) => selectedPath[level])
    if (!hasAnyPath) return filteredSnapshots
    return filteredSnapshots
      .map((snapshot) => ({
        name: snapshot.name,
        points: snapshot.points.filter((point) => {
          return LEVEL_ORDER.every((level) => {
            const expected = selectedPath[level]
            if (!expected) return true
            return levelValue(point, level) === expected
          })
        }),
      }))
      .filter((snapshot) => snapshot.points.length > 0)
  }, [filteredSnapshots, selectedPath])

  const renderPointLevel = useMemo<Level>(() => {
    return activeLevel === 'continent' ? 'country' : activeLevel
  }, [activeLevel])

  const frames = useMemo<NextGenFrame[]>(() => {
    const scopedSnapshots = filteredSnapshots
      .map((snapshot) => ({
        name: snapshot.name,
        points: snapshot.points.filter((point) => {
          return LEVEL_ORDER.every((level) => {
            const expected = selectedPath[level]
            if (!expected) return true
            if (level === renderPointLevel) return true
            return levelValue(point, level) === expected
          })
        }),
      }))
      .filter((snapshot) => snapshot.points.length > 0)

    const centroidByKey = new Map<string, { count: number; latSum: number; lonSum: number; total: number }>()
    const valuesByFrame = scopedSnapshots.map((snapshot) => {
      const grouped = new Map<string, number>()
      snapshot.points.forEach((point) => {
        const key = levelKey(point, renderPointLevel)
        grouped.set(key, (grouped.get(key) || 0) + point.value)

        const centroid = centroidByKey.get(key)
        if (!centroid) {
          centroidByKey.set(key, { count: 1, latSum: point.lat, lonSum: point.lon, total: point.value })
        } else {
          centroid.count += 1
          centroid.latSum += point.lat
          centroid.lonSum += point.lon
          centroid.total += point.value
        }
      })

      return {
        name: snapshot.name,
        totals: grouped,
      }
    })

    const capByLevel: Record<Level, number> = {
      continent: 20,
      country: 220,
      state: 320,
      county: 420,
      city: 520,
    }

    const orderedKeys = [...centroidByKey.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, capByLevel[renderPointLevel])
      .map(([key]) => key)

    const centroidPoints = new Map<string, { lat: number; lon: number }>()
    orderedKeys.forEach((key) => {
      const centroid = centroidByKey.get(key)
      if (!centroid) return
      centroidPoints.set(key, {
        lat: centroid.latSum / centroid.count,
        lon: centroid.lonSum / centroid.count,
      })
    })

    const max = valuesByFrame.reduce((acc, frame) => {
      let localMax = 0
      orderedKeys.forEach((key) => {
        localMax = Math.max(localMax, frame.totals.get(key) || 0)
      })
      return Math.max(acc, localMax)
    }, 0)
    const safeMax = max > 0 ? max : 1
    const intensityFactor = 0.05 + pointIntensity * 0.05

    return valuesByFrame
      .map((snapshot) => ({
        name: snapshot.name,
        points: orderedKeys
          .map((key) => {
            const centroid = centroidPoints.get(key)
            if (!centroid) return null
            const value = snapshot.totals.get(key) || 0
            const magnitude = Math.min((value / safeMax) * intensityFactor, 0.2)
            return [centroid.lat, centroid.lon, Math.max(0, magnitude)] as [number, number, number]
          })
          .filter((point): point is [number, number, number] => point !== null),
      }))
      .filter((snapshot) => snapshot.points.length > 0)
  }, [filteredSnapshots, selectedPath, renderPointLevel, pointIntensity])

  const highlights = useMemo(() => {
    if (!currentFrame || !selectedNode) return [] as Array<[number, number, number]>
    return currentFrame.points
      .filter((point) => levelKey(point, activeLevel) === selectedNode.key)
      .slice(0, 200)
      .map((point) => [point.lat, point.lon, point.value] as [number, number, number])
  }, [currentFrame, selectedNode, activeLevel])

  const focusPayload = useMemo(() => {
    if (!selectedNode) return null
    const latSpan = Math.abs(selectedNode.maxLat - selectedNode.minLat)
    const lonSpan = Math.abs(selectedNode.maxLon - selectedNode.minLon)
    const spread = Math.max(latSpan, lonSpan)
    const zoomBoundsByLevel: Record<Level, { min: number; max: number }> = {
      continent: { min: 700, max: 920 },
      country: { min: 560, max: 860 },
      state: { min: 450, max: 760 },
      county: { min: 360, max: 650 },
      city: { min: 300, max: 560 },
    }
    const bounds = zoomBoundsByLevel[activeLevel]
    const zoomDistance = clamp(340 + spread * 9, bounds.min, bounds.max)
    return {
      requestId: focusRequestId,
      lat: selectedNode.lat,
      lon: selectedNode.lon,
      zoomDistance,
      label: `${selectedNode.name} (${activeLevel})`,
    }
  }, [selectedNode, focusRequestId, activeLevel])

  const zoomScale = useMemo(() => {
    const distance = focusPayload?.zoomDistance ?? 920
    return clamp(980 / Math.max(220, distance), 0.85, 2.2)
  }, [focusPayload])

  const regionLayer = useMemo<RegionLayerPayload | null>(() => {
    const all = regionLayerByLevel[activeLevel]
    if (!all || !all.length) return null

    const parents = parentLevels(activeLevel)
    const filtered = all.filter((feature) => {
      return parents.every((level) => {
        const expected = selectedPath[level]
        if (!expected) return true
        return labelsMatch(feature.properties.labels?.[level], expected)
      })
    })

    const triageThreshold = 0.35
    const triageMode = showRegionQualityDebug
      ? (regionTriageMode !== 'all' ? regionTriageMode : showOnlyLowQualityRegions ? 'low-quality' : 'all')
      : 'all'

    const triageFiltered = filtered.filter((feature) => {
      if (triageMode === 'all') return true
      const strategy = String(feature.properties.geometryStrategy || 'unknown')
      if (triageMode === 'low-quality') {
        return Number(feature.properties.qualityScore ?? 0.45) < triageThreshold
      }
      if (triageMode === 'bbox-fallback') {
        return strategy === 'bbox-fallback'
      }
      if (triageMode === 'degenerate') {
        return strategy === 'bbox-degenerate'
      }
      return true
    })

    const sorted = [...triageFiltered].sort((a, b) => (b.properties.totalValue || 0) - (a.properties.totalValue || 0))
    const capByLevel: Record<Level, number> = {
      continent: 10,
      country: 120,
      state: 280,
      county: 780,
      city: 980,
    }
    const capped = sorted.slice(0, capByLevel[activeLevel])

    return {
      level: activeLevel,
      selectedKey: selectedPath[activeLevel] || activeNodeKey || '',
      features: capped.map((feature) => ({
        key: feature.properties.key,
        label: feature.properties.labels?.[activeLevel] || feature.properties.key,
        count: Number(feature.properties.count || 0),
        totalValue: Number(feature.properties.totalValue || 0),
        qualityScore: clamp(Number(feature.properties.qualityScore ?? 0.45), 0, 1),
        sourcePointCount: Number(feature.properties.sourcePointCount || 0),
        hullVertexCount: Number(feature.properties.hullVertexCount || 0),
        geometryStrategy: String(feature.properties.geometryStrategy || 'unknown'),
        paths: normalizeFeaturePaths(feature),
      })),
    }
  }, [regionLayerByLevel, activeLevel, selectedPath, activeNodeKey, showRegionQualityDebug, showOnlyLowQualityRegions, regionTriageMode])

  const contextLayer = useMemo<RegionLayerPayload | null>(() => {
    const level = activeLevel === 'continent' || activeLevel === 'country'
      ? nextLevel(activeLevel)
      : previousLevel(activeLevel)
    if (!level) return null

    const all = regionLayerByLevel[level]
    if (!all || !all.length) return null

    const parents = parentLevels(level)
    const filtered = all.filter((feature) => {
      return parents.every((parentLevel) => {
        const expected = selectedPath[parentLevel]
        if (!expected) return true
        return labelsMatch(feature.properties.labels?.[parentLevel], expected)
      })
    })

    const triageThreshold = 0.35
    const triageMode = showRegionQualityDebug
      ? (regionTriageMode !== 'all' ? regionTriageMode : showOnlyLowQualityRegions ? 'low-quality' : 'all')
      : 'all'

    const triageFiltered = filtered.filter((feature) => {
      if (triageMode === 'all') return true
      const strategy = String(feature.properties.geometryStrategy || 'unknown')
      if (triageMode === 'low-quality') {
        return Number(feature.properties.qualityScore ?? 0.45) < triageThreshold
      }
      if (triageMode === 'bbox-fallback') {
        return strategy === 'bbox-fallback'
      }
      if (triageMode === 'degenerate') {
        return strategy === 'bbox-degenerate'
      }
      return true
    })

    const sorted = [...triageFiltered].sort((a, b) => (b.properties.totalValue || 0) - (a.properties.totalValue || 0))
    const capByLevel: Record<Level, number> = {
      continent: 12,
      country: 180,
      state: 320,
      county: 760,
      city: 1050,
    }
    const capped = sorted.slice(0, capByLevel[level])

    return {
      level,
      selectedKey: selectedPath[level] || '',
      features: capped.map((feature) => ({
        key: feature.properties.key,
        label: feature.properties.labels?.[level] || feature.properties.key,
        count: Number(feature.properties.count || 0),
        totalValue: Number(feature.properties.totalValue || 0),
        qualityScore: clamp(Number(feature.properties.qualityScore ?? 0.45), 0, 1),
        sourcePointCount: Number(feature.properties.sourcePointCount || 0),
        hullVertexCount: Number(feature.properties.hullVertexCount || 0),
        geometryStrategy: String(feature.properties.geometryStrategy || 'unknown'),
        paths: normalizeFeaturePaths(feature),
      })),
    }
  }, [regionLayerByLevel, activeLevel, selectedPath, showRegionQualityDebug, showOnlyLowQualityRegions, regionTriageMode])

  const selectedRegionFeature = useMemo(() => {
    if (!regionLayer) return null
    const key = regionLayer.selectedKey || activeNodeKey || selectedPath[activeLevel] || ''
    if (!key) return null
    return regionLayer.features.find((feature) => feature.key === key) ?? null
  }, [regionLayer, activeNodeKey, selectedPath, activeLevel])

  const exportRegionTriage = (format: 'json' | 'csv') => {
    if (!regionLayer || !regionLayer.features.length) return
    const rows = regionLayer.features.map((feature) => ({
      level: regionLayer.level,
      key: feature.key,
      label: feature.label,
      qualityScore: Number(feature.qualityScore.toFixed(3)),
      geometryStrategy: feature.geometryStrategy,
      sourcePointCount: feature.sourcePointCount,
      hullVertexCount: feature.hullVertexCount,
      pathCount: feature.paths.length,
      rowCount: feature.count,
      totalValue: Number(feature.totalValue.toFixed(2)),
      selected: feature.key === regionLayer.selectedKey,
      triageMode: showRegionQualityDebug ? regionTriageMode : 'all',
    }))

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const base = `region-triage-${regionLayer.level}-${stamp}`

    if (format === 'json') {
      const payload = {
        generatedAt: new Date().toISOString(),
        level: regionLayer.level,
        selectedKey: regionLayer.selectedKey,
        triageMode: showRegionQualityDebug ? regionTriageMode : 'all',
        count: rows.length,
        rows,
      }
      downloadTextFile(`${base}.json`, `${JSON.stringify(payload, null, 2)}\n`, 'application/json;charset=utf-8')
      return
    }

    const headers = ['level', 'key', 'label', 'qualityScore', 'geometryStrategy', 'sourcePointCount', 'hullVertexCount', 'pathCount', 'rowCount', 'totalValue', 'selected', 'triageMode']
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => toCsvCell((row as Record<string, string | number | boolean>)[header] as string | number)).join(',')),
    ].join('\n')
    downloadTextFile(`${base}.csv`, `${csv}\n`, 'text/csv;charset=utf-8')
  }

  const layerQualitySummary = useMemo(() => {
    const byLevel = LEVEL_ORDER.map((level) => {
      const features = regionLayerByLevel[level] || []
      let low = 0
      let fallback = 0
      for (let idx = 0; idx < features.length; idx += 1) {
        const feature = features[idx]
        const quality = Number(feature.properties.qualityScore ?? 0.45)
        const strategy = String(feature.properties.geometryStrategy || 'unknown')
        if (quality < 0.35) low += 1
        if (strategy === 'bbox-fallback' || strategy === 'bbox-degenerate') fallback += 1
      }
      const total = features.length
      const unresolved = low + fallback
      return { level, total, low, fallback, unresolved }
    })

    return {
      byLevel,
      totalFeatures: byLevel.reduce((sum, item) => sum + item.total, 0),
      totalLow: byLevel.reduce((sum, item) => sum + item.low, 0),
      totalFallback: byLevel.reduce((sum, item) => sum + item.fallback, 0),
      totalUnresolved: byLevel.reduce((sum, item) => sum + item.unresolved, 0),
    }
  }, [regionLayerByLevel])

  const exportUnresolvedRegionsReport = (format: 'json' | 'csv') => {
    const rows = LEVEL_ORDER.flatMap((level) => {
      const features = regionLayerByLevel[level] || []
      return features
        .map((feature) => {
          const strategy = String(feature.properties.geometryStrategy || 'unknown')
          const quality = clamp(Number(feature.properties.qualityScore ?? 0.45), 0, 1)
          const isFallback = strategy === 'bbox-fallback' || strategy === 'bbox-degenerate'
          const isLow = quality < 0.35
          if (!isFallback && !isLow) return null
          return {
            level,
            key: String(feature.properties.key || ''),
            label: String(feature.properties.labels?.[level] || feature.properties.key || ''),
            qualityScore: Number(quality.toFixed(3)),
            geometryStrategy: strategy,
            sourcePointCount: Number(feature.properties.sourcePointCount || 0),
            hullVertexCount: Number(feature.properties.hullVertexCount || 0),
            rowCount: Number(feature.properties.count || 0),
            totalValue: Number(feature.properties.totalValue || 0),
            unresolvedReason: isFallback && isLow ? 'fallback+low-quality' : isFallback ? 'fallback' : 'low-quality',
          }
        })
        .filter((row): row is {
          level: Level
          key: string
          label: string
          qualityScore: number
          geometryStrategy: string
          sourcePointCount: number
          hullVertexCount: number
          rowCount: number
          totalValue: number
          unresolvedReason: string
        } => row !== null)
    })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const base = `region-unresolved-report-${stamp}`
    if (format === 'json') {
      const payload = {
        generatedAt: new Date().toISOString(),
        totals: {
          features: layerQualitySummary.totalFeatures,
          lowQuality: layerQualitySummary.totalLow,
          fallback: layerQualitySummary.totalFallback,
          unresolved: layerQualitySummary.totalUnresolved,
        },
        byLevel: layerQualitySummary.byLevel,
        rows,
      }
      downloadTextFile(`${base}.json`, `${JSON.stringify(payload, null, 2)}\n`, 'application/json;charset=utf-8')
      return
    }

    const headers = ['level', 'key', 'label', 'qualityScore', 'geometryStrategy', 'sourcePointCount', 'hullVertexCount', 'rowCount', 'totalValue', 'unresolvedReason']
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => toCsvCell((row as Record<string, string | number>)[header] as string | number)).join(',')),
    ].join('\n')
    downloadTextFile(`${base}.csv`, `${csv}\n`, 'text/csv;charset=utf-8')
  }

  const activeFramePoints = useMemo(() => {
    const frame = filteredByNode[selectedFrameClamped]
    return frame?.points ?? []
  }, [filteredByNode, selectedFrameClamped])

  const groupedClusters = useMemo<GroupClusterPayload[]>(() => {
    if (!activeFramePoints.length) return []
    const buckets = new Map<string, { points: Array<[number, number, number]>; total: number }>()
    activeFramePoints.forEach((point) => {
      const key = groupLabel(point, groupMode)
      const existing = buckets.get(key)
      const tuple: [number, number, number] = [point.lat, point.lon, point.value]
      if (!existing) {
        buckets.set(key, { points: [tuple], total: point.value })
        return
      }
      existing.points.push(tuple)
      existing.total += point.value
    })

    return [...buckets.entries()]
      .map(([key, value], idx) => ({
        key,
        label: key,
        color: GROUP_COLORS[idx % GROUP_COLORS.length],
        points: value.points,
        total: value.total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(({ total: _total, ...rest }) => rest)
  }, [activeFramePoints, groupMode])

  const temperatureLayer = useMemo<TemperaturePayload | null>(() => {
    if (!activeFramePoints.length) return null
    const maxValue = activeFramePoints.reduce((acc, point) => Math.max(acc, point.value), 0) || 1
    const cold = clamp(coldThreshold, 0.05, 0.9)
    const hot = clamp(hotThreshold, cold + 0.05, 0.98)
    return {
      coldThreshold: cold,
      hotThreshold: hot,
      points: activeFramePoints
        .slice(0, 1400)
        .map((point) => [point.lat, point.lon, clamp(point.value / maxValue, 0, 1)] as [number, number, number]),
    }
  }, [activeFramePoints, coldThreshold, hotThreshold])

  const groundHeatCells = useMemo(() => {
    if (!activeFramePoints.length) return [] as HeatCellPayload[]
    return buildHeatCells(activeFramePoints, 1200)
  }, [activeFramePoints])

  const nonTerrestrialObjects = useMemo<OrbitalObjectPayload[]>(() => {
    const datasetPreferred = (orbitalTimeseries.length ? orbitalTimeseries : orbitalCatalog)
      .slice(0, 220)
      .map((item) => ({
        id: item.id,
        label: item.label,
        sourceType: item.sourceType,
        lat: item.lat,
        lon: item.lon,
        altitudeKm: item.altitudeKm,
        confidence: clamp(item.confidence ?? 0.82, 0.35, 0.99),
      }))
    if (datasetPreferred.length) return datasetPreferred

    const candidates: Array<OrbitalObjectPayload | null> = activeFramePoints
      .map((point, idx): OrbitalObjectPayload | null => {
        const sourceLabel = `${point.source || ''} ${point.category || ''} ${point.label || ''}`.trim()
        const sourceType = inferOrbitalSourceType(sourceLabel)
        const taggedAsOrbital = sourceType !== 'demo'
        if (!taggedAsOrbital) return null

        const confidence = clamp(0.62 + Math.min(0.3, point.value / 250), 0.62, 0.96)
        return {
          id: `tracked-${idx}-${normalizeLabel(point.label || point.source || String(idx))}`,
          label: point.label || point.source || `Tracked object ${idx + 1}`,
          sourceType,
          lat: point.lat,
          lon: point.lon,
          altitudeKm: sourceAltitudeKm(sourceType),
          confidence,
        }
      })

    const mapped: OrbitalObjectPayload[] = candidates
      .filter((item): item is OrbitalObjectPayload => item !== null)
      .slice(0, 90)

    if (mapped.length) return mapped
    return DEMO_ORBITAL_OBJECTS
  }, [activeFramePoints, orbitalCatalog, orbitalTimeseries])

  const nonTerrestrialDatasetSummary = useMemo(() => {
    if (orbitalTimeseries.length) return `timeseries:${orbitalTimeseries.length}`
    if (orbitalCatalog.length) return `catalog:${orbitalCatalog.length}`
    return 'fallback:frame+demo'
  }, [orbitalCatalog.length, orbitalTimeseries.length])

  const nonTerrestrialSourceSummary = useMemo(() => {
    const counts = nonTerrestrialObjects.reduce((acc, object) => {
      acc.set(object.sourceType, (acc.get(object.sourceType) || 0) + 1)
      return acc
    }, new Map<OrbitalObjectPayload['sourceType'], number>())

    const ordered: OrbitalObjectPayload['sourceType'][] = ['starlink', 'nasa', 'gps', 'comms', 'tracked', 'demo']
    return ordered
      .filter((key) => (counts.get(key) || 0) > 0)
      .map((key) => `${key}:${counts.get(key)}`)
      .join(' • ')
  }, [nonTerrestrialObjects])

  const anchorLayer = useMemo<AnchorPayload | null>(() => {
    if (!selectedNode || !currentFrame) return null
    const parent = parentLevels(activeLevel)
    const scoped = currentFrame.points.filter((point) => {
      const sameParent = parent.every((level) => {
        const selected = selectedPath[level]
        if (!selected) return true
        return levelValue(point, level) === selected
      })
      return sameParent && levelValue(point, activeLevel) !== selectedNode.key
    })

    return {
      key: selectedNode.key,
      label: selectedNode.name,
      related: scoped.slice(0, 450).map((point) => [point.lat, point.lon, point.value] as [number, number, number]),
    }
  }, [selectedNode, currentFrame, activeLevel, selectedPath])

  const hierarchyNodeIndexes = useMemo(() => {
    const all = hierarchyNodes.filter((node) => node.key !== selectedNode?.key)
    const byBand = new Map<string, RegionNode[]>()
    const bySource = new Map<string, RegionNode[]>()
    const byCategory = new Map<string, RegionNode[]>()
    const byContinent = new Map<string, RegionNode[]>()

    all.forEach((node) => {
      const bandNodes = byBand.get(node.bandLabel)
      if (!bandNodes) byBand.set(node.bandLabel, [node])
      else bandNodes.push(node)

      const sourceNodes = bySource.get(node.sourceTag)
      if (!sourceNodes) bySource.set(node.sourceTag, [node])
      else sourceNodes.push(node)

      const categoryNodes = byCategory.get(node.categoryTag)
      if (!categoryNodes) byCategory.set(node.categoryTag, [node])
      else categoryNodes.push(node)

      const continentNodes = byContinent.get(node.continentTag)
      if (!continentNodes) byContinent.set(node.continentTag, [node])
      else continentNodes.push(node)
    })

    return {
      all,
      byBand,
      bySource,
      byCategory,
      byContinent,
    }
  }, [hierarchyNodes, selectedNode])

  const scopeFilteredConnectionNodes = useMemo(() => {
    if (!selectedNode) return [] as RegionNode[]
    if (connectionScope === 'intra-region') {
      return hierarchyNodeIndexes.byBand.get(selectedNode.bandLabel) || []
    }
    if (connectionScope === 'inter-region') {
      return hierarchyNodeIndexes.all.filter((node) => node.bandLabel !== selectedNode.bandLabel)
    }
    return hierarchyNodeIndexes.all
  }, [selectedNode, connectionScope, hierarchyNodeIndexes])

  const groupedConnectionNodes = useMemo(() => {
    if (!selectedNode) return [] as RegionNode[]
    if (connectionGroupFilter === 'none') return scopeFilteredConnectionNodes

    const grouped = connectionGroupFilter === 'source'
      ? (hierarchyNodeIndexes.bySource.get(selectedNode.sourceTag) || [])
      : connectionGroupFilter === 'category'
        ? (hierarchyNodeIndexes.byCategory.get(selectedNode.categoryTag) || [])
        : (hierarchyNodeIndexes.byContinent.get(selectedNode.continentTag) || [])

    if (connectionScope === 'all') return grouped

    const scopedKeys = new Set(scopeFilteredConnectionNodes.map((node) => node.key))
    return grouped.filter((node) => scopedKeys.has(node.key))
  }, [selectedNode, connectionGroupFilter, connectionScope, scopeFilteredConnectionNodes, hierarchyNodeIndexes])

  const connectionPeers = useMemo(() => {
    return groupedConnectionNodes.slice(0, maxConnections)
  }, [groupedConnectionNodes, maxConnections])

  const connectionFilterStats = useMemo(() => {
    return {
      totalPeers: hierarchyNodeIndexes.all.length,
      scopePeers: scopeFilteredConnectionNodes.length,
      groupPeers: groupedConnectionNodes.length,
      renderedArcs: connectionPeers.length,
    }
  }, [hierarchyNodeIndexes, scopeFilteredConnectionNodes, groupedConnectionNodes, connectionPeers])

  const operationalTelemetryThresholds = useMemo(() => {
    return {
      staleWarnSec: 10 * 60,
      staleCriticalSec: 30 * 60,
      renderWarnMs: 24,
      renderCriticalMs: 42,
    }
  }, [])

  const dataAgeSec = useMemo(() => {
    const frameName = frames[selectedFrameClamped]?.name || ''
    const frameTs = parseTimestamp(frameName)
    const refreshTs = parseTimestamp(dataRefreshedAt)
    const baseline = frameTs ?? refreshTs ?? Date.now()
    return Math.max(0, Math.round((Date.now() - baseline) / 1000))
  }, [frames, selectedFrameClamped, dataRefreshedAt])

  const operationalConfidence = useMemo(() => {
    const selectedQuality = selectedRegionFeature
      ? clamp(Number(selectedRegionFeature.qualityScore || 0.45), 0, 1)
      : regionLayer && regionLayer.features.length
        ? clamp(regionLayer.features.reduce((sum, feature) => sum + Number(feature.qualityScore || 0.45), 0) / regionLayer.features.length, 0, 1)
        : 0.58

    const strategy = selectedRegionFeature?.geometryStrategy || ''
    const strategyPenalty = strategy === 'bbox-degenerate' ? 0.34 : strategy === 'bbox-fallback' ? 0.22 : 0
    const sourceCoverageBoost = selectedRegionFeature
      ? clamp(selectedRegionFeature.sourcePointCount / Math.max(1, selectedRegionFeature.hullVertexCount * 2), 0, 0.12)
      : 0
    const region = clamp(selectedQuality - strategyPenalty + sourceCoverageBoost, 0, 1)

    const contextQuality = contextLayer && contextLayer.features.length
      ? clamp(contextLayer.features.reduce((sum, feature) => sum + Number(feature.qualityScore || 0.45), 0) / contextLayer.features.length, 0, 1)
      : 0.64
    const contextFallbackRatio = contextLayer && contextLayer.features.length
      ? contextLayer.features.filter((feature) => feature.geometryStrategy === 'bbox-fallback' || feature.geometryStrategy === 'bbox-degenerate').length / contextLayer.features.length
      : 0
    const context = clamp(contextQuality - contextFallbackRatio * 0.22, 0, 1)

    const peerStrength = connectionPeers.length && selectedNode
      ? connectionPeers.reduce((sum, peer) => sum + clamp(peer.total / Math.max(1, selectedNode.total), 0.1, 1), 0) / connectionPeers.length
      : 0
    const arcCoverage = clamp(connectionFilterStats.renderedArcs / Math.max(1, maxConnections), 0, 1)
    const arcs = showConnections
      ? clamp(0.35 + arcCoverage * 0.32 + peerStrength * 0.33, 0, 1)
      : 0.8

    const overall = clamp(region * 0.46 + context * 0.24 + arcs * 0.3, 0, 1)
    return { region, context, arcs, overall }
  }, [selectedRegionFeature, regionLayer, contextLayer, connectionPeers, selectedNode, connectionFilterStats, maxConnections, showConnections])

  const operationalProvenance = useMemo(() => {
    return {
      appId: SPLUNK_APP_ID,
      source: 'inputlookup geo_points_us_eu_hierarchy.csv',
      frame: frames[selectedFrameClamped]?.name || '(none)',
      dataRefreshedAt,
      layersRefreshedAt,
      activeLevel,
    }
  }, [frames, selectedFrameClamped, dataRefreshedAt, layersRefreshedAt, activeLevel])

  const telemetryState = useMemo(() => {
    return {
      stale: thresholdState(dataAgeSec, operationalTelemetryThresholds.staleWarnSec, operationalTelemetryThresholds.staleCriticalSec),
      confidence: confidenceState(operationalConfidence.overall),
    }
  }, [dataAgeSec, operationalTelemetryThresholds, operationalConfidence])

  const layerRegistryEntries = useMemo<LayerRegistryEntry[]>(() => {
    const staleState = thresholdState(dataAgeSec, operationalTelemetryThresholds.staleWarnSec, operationalTelemetryThresholds.staleCriticalSec)
    const updatedAt = dataRefreshedAt
    const regionCount = regionLayer?.features.length ?? 0
    const contextCount = contextLayer?.features.length ?? 0
    const arcCount = connectionFilterStats.renderedArcs
    const flowCount = Math.min(hierarchyNodes.length, 60)
    const groupCount = groupedClusters.length
    const temperatureCount = temperatureLayer?.points.length ?? 0
    const anchorCount = anchorLayer?.related.length ?? 0
    const heatCount = groundHeatCells.length
    const adapterBaseConfidence = pilotAdapterStatus === 'critical' ? 0.4 : pilotAdapterStatus === 'warning' ? 0.62 : 0.82
    const adapterConfidence = clamp(adapterBaseConfidence + Math.min(0.14, pilotAdapterSampleCount / 450), 0, 1)

    const stalePenalty = staleState === 'critical' ? 0.18 : staleState === 'warning' ? 0.08 : 0
    const asHealth = (score: number) => scoreToHealth(clamp(score - stalePenalty, 0, 1))

    return [
      {
        id: 'region-layer',
        label: 'Region boundaries',
        source: 'nextgen-region-layers/*.geojson',
        enabled: showRegionHighlight,
        confidence: operationalConfidence.region,
        entityCount: regionCount,
        updatedAt,
        health: asHealth(operationalConfidence.region),
      },
      {
        id: 'context-layer',
        label: 'Parent context boundaries',
        source: 'nextgen-region-layers/*.geojson',
        enabled: showContextLayer,
        confidence: operationalConfidence.context,
        entityCount: contextCount,
        updatedAt,
        health: asHealth(operationalConfidence.context),
      },
      {
        id: 'connection-arcs',
        label: 'Great-circle arcs',
        source: 'derived-from-selected-peers',
        enabled: showConnections,
        confidence: operationalConfidence.arcs,
        entityCount: arcCount,
        updatedAt,
        health: asHealth(operationalConfidence.arcs),
      },
      {
        id: 'flow-vectors',
        label: 'Flow vectors',
        source: 'derived-from-hierarchy-nodes',
        enabled: showFlow,
        confidence: clamp(operationalConfidence.overall * 0.92, 0, 1),
        entityCount: flowCount,
        updatedAt,
        health: asHealth(operationalConfidence.overall * 0.92),
      },
      {
        id: 'grouping',
        label: 'Grouping clusters',
        source: 'derived-from-active-frame',
        enabled: showGrouping,
        confidence: clamp(operationalConfidence.overall * 0.9, 0, 1),
        entityCount: groupCount,
        updatedAt,
        health: asHealth(operationalConfidence.overall * 0.9),
      },
      {
        id: 'temperature',
        label: 'Temperature layer',
        source: 'derived-from-active-frame',
        enabled: showTemperature,
        confidence: clamp(operationalConfidence.overall * 0.88, 0, 1),
        entityCount: temperatureCount,
        updatedAt,
        health: asHealth(operationalConfidence.overall * 0.88),
      },
      {
        id: 'anchor',
        label: 'Anchor-related points',
        source: 'selected-node-neighborhood',
        enabled: showAnchorRelated,
        confidence: clamp(operationalConfidence.overall * 0.9, 0, 1),
        entityCount: anchorCount,
        updatedAt,
        health: asHealth(operationalConfidence.overall * 0.9),
      },
      {
        id: 'ground-heat',
        label: 'Ground heat',
        source: 'derived-heat-cells',
        enabled: showGroundHeat,
        confidence: clamp(operationalConfidence.overall * 0.86, 0, 1),
        entityCount: heatCount,
        updatedAt,
        health: asHealth(operationalConfidence.overall * 0.86),
      },
      {
        id: 'pilot-adapter',
        label: 'Pilot ingest adapter',
        source: pilotAdapter.source,
        enabled: true,
        confidence: adapterConfidence,
        entityCount: pilotAdapterSampleCount,
        updatedAt: pilotAdapterLastFetchAt || pilotAdapterCheckedAt || updatedAt,
        health: pilotAdapterStatus,
      },
    ]
  }, [
    dataAgeSec,
    operationalTelemetryThresholds,
    dataRefreshedAt,
    regionLayer,
    contextLayer,
    connectionFilterStats,
    hierarchyNodes,
    groupedClusters,
    temperatureLayer,
    anchorLayer,
    groundHeatCells,
    showRegionHighlight,
    showContextLayer,
    showConnections,
    showFlow,
    showGrouping,
    showTemperature,
    showAnchorRelated,
    showGroundHeat,
    operationalConfidence,
    pilotAdapter,
    pilotAdapterStatus,
    pilotAdapterSampleCount,
    pilotAdapterLastFetchAt,
    pilotAdapterCheckedAt,
  ])

  const operationalProvenanceResolved = useMemo(() => {
    const staleState = thresholdState(dataAgeSec, operationalTelemetryThresholds.staleWarnSec, operationalTelemetryThresholds.staleCriticalSec)
    const layers = layerRegistryEntries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      source: entry.source,
      enabled: entry.enabled,
      entityCount: entry.entityCount,
      confidence: Number(entry.confidence.toFixed(3)),
      health: entry.health,
      updatedAt: entry.updatedAt,
      staleState,
    }))

    return {
      ...operationalProvenance,
      layers,
      registrySummary: summarizeLayerRegistry(layerRegistryEntries),
      pilotAdapter: {
        id: pilotAdapter.id,
        source: pilotAdapter.source,
        status: pilotAdapterStatus,
        detail: pilotAdapterDetail,
        checkedAt: pilotAdapterCheckedAt,
        lastFetchAt: pilotAdapterLastFetchAt || pilotAdapterCheckedAt,
        sampleCount: pilotAdapterSampleCount,
      },
    }
  }, [operationalProvenance, layerRegistryEntries, pilotAdapter, dataAgeSec, operationalTelemetryThresholds, pilotAdapterStatus, pilotAdapterDetail, pilotAdapterCheckedAt, pilotAdapterLastFetchAt, pilotAdapterSampleCount])

  const connectionArcs = useMemo<ArcPayload[]>(() => {
    if (!selectedNode || !connectionPeers.length) return []

    const maxTotal = Math.max(selectedNode.total, ...connectionPeers.map((node) => node.total), 1)

    if (connectionMode === 'sequential') {
      const chain = [selectedNode, ...connectionPeers]
      const links: ArcPayload[] = []
      for (let idx = 0; idx < chain.length - 1; idx += 1) {
        const fromNode = chain[idx]
        const toNode = chain[idx + 1]
        const weight = clamp((fromNode.total + toNode.total) / (maxTotal * 2), 0.1, 1)
        links.push({
          from: [fromNode.lat, fromNode.lon],
          to: [toNode.lat, toNode.lon],
          weight,
          group: toNode.name,
        })
      }
      return links
    }

    return connectionPeers.map((target) => ({
      from: [selectedNode.lat, selectedNode.lon],
      to: [target.lat, target.lon],
      weight: clamp(target.total / maxTotal, 0.1, 1),
      group: target.name,
    }))
  }, [selectedNode, connectionPeers, connectionMode])

  const exportOperationalSnapshot = (format: 'json' | 'csv') => {
    const snapshot = {
      generatedAt: new Date().toISOString(),
      confidence: {
        region: Number(operationalConfidence.region.toFixed(3)),
        context: Number(operationalConfidence.context.toFixed(3)),
        arcs: Number(operationalConfidence.arcs.toFixed(3)),
        overall: Number(operationalConfidence.overall.toFixed(3)),
      },
      confidenceState: telemetryState.confidence,
      provenance: operationalProvenanceResolved,
      telemetry: {
        dataAgeSec,
        dataAgeLabel: formatDuration(dataAgeSec),
        staleState: telemetryState.stale,
        ...operationalTelemetryThresholds,
      },
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const base = `ops-confidence-provenance-${SPLUNK_APP_ID}-${stamp}`

    if (format === 'json') {
      downloadTextFile(`${base}.json`, `${JSON.stringify(snapshot, null, 2)}\n`, 'application/json;charset=utf-8')
      return
    }

    const row = {
      generatedAt: snapshot.generatedAt,
      appId: snapshot.provenance.appId,
      source: snapshot.provenance.source,
      frame: snapshot.provenance.frame,
      activeLevel: snapshot.provenance.activeLevel,
      dataRefreshedAt: snapshot.provenance.dataRefreshedAt,
      layersRefreshedAt: snapshot.provenance.layersRefreshedAt,
      confidenceRegion: snapshot.confidence.region,
      confidenceContext: snapshot.confidence.context,
      confidenceArcs: snapshot.confidence.arcs,
      confidenceOverall: snapshot.confidence.overall,
      confidenceState: snapshot.confidenceState,
      dataAgeSec: snapshot.telemetry.dataAgeSec,
      dataAgeLabel: snapshot.telemetry.dataAgeLabel,
      staleState: snapshot.telemetry.staleState,
      staleWarnSec: snapshot.telemetry.staleWarnSec,
      staleCriticalSec: snapshot.telemetry.staleCriticalSec,
      renderWarnMs: snapshot.telemetry.renderWarnMs,
      renderCriticalMs: snapshot.telemetry.renderCriticalMs,
      registryTotal: snapshot.provenance.registrySummary.total,
      registryEnabled: snapshot.provenance.registrySummary.enabled,
      registryHealthy: snapshot.provenance.registrySummary.healthy,
      registryWarning: snapshot.provenance.registrySummary.warning,
      registryCritical: snapshot.provenance.registrySummary.critical,
      pilotAdapterId: snapshot.provenance.pilotAdapter.id,
      pilotAdapterSource: snapshot.provenance.pilotAdapter.source,
      pilotAdapterStatus: snapshot.provenance.pilotAdapter.status,
      pilotAdapterCheckedAt: snapshot.provenance.pilotAdapter.checkedAt,
      pilotAdapterLastFetchAt: snapshot.provenance.pilotAdapter.lastFetchAt,
      pilotAdapterSampleCount: snapshot.provenance.pilotAdapter.sampleCount,
    }

    const headers = Object.keys(row)
    const csv = [
      headers.join(','),
      headers.map((header) => toCsvCell((row as Record<string, string | number>)[header])).join(','),
    ].join('\n')
    downloadTextFile(`${base}.csv`, `${csv}\n`, 'text/csv;charset=utf-8')
  }

  const flowVectors = useMemo<FlowVectorPayload[]>(() => {
    const nodes = hierarchyNodes.slice(0, 60)
    if (!nodes.length) return []
    const maxTotal = nodes.reduce((acc, node) => Math.max(acc, node.total), 0) || 1
    return nodes.map((node) => ({
      lat: node.lat,
      lon: node.lon,
      bearing: hashString(node.key) % 360,
      magnitude: clamp(node.total / maxTotal, 0.1, 1),
    }))
  }, [hierarchyNodes])

  const frameHeight = useMemo(() => {
    if (!fullView) return 780
    const reservedTop = settingsCollapsed ? 170 : 330
    return clamp(viewportHeight - reservedTop, 500, 1400)
  }, [fullView, viewportHeight, settingsCollapsed])

  useEffect(() => {
    function onGlobeClick(event: MessageEvent) {
      const data = event.data as NextGenClickMessage | undefined
      if (!data || data.type !== 'splunk-nextgen:globe-click') return
      if (!hierarchyNodes.length) return

      const lat = Number(data.payload?.lat)
      const lon = Number(data.payload?.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return

      let best: RegionNode | null = null
      let score = Number.POSITIVE_INFINITY
      for (let idx = 0; idx < hierarchyNodes.length; idx += 1) {
        const candidate = hierarchyNodes[idx]
        const nextScore = angularDistanceScore(lat, lon, candidate.lat, candidate.lon)
        if (nextScore < score) {
          score = nextScore
          best = candidate
        }
      }
      if (!best) return
      if (score > 0.08) return

      selectNodeAndDrill(best)
    }

    window.addEventListener('message', onGlobeClick)
    return () => window.removeEventListener('message', onGlobeClick)
  }, [hierarchyNodes, activeLevel])

  useEffect(() => {
    async function load() {
      setStatus('loading')
      setError('')
      try {
        const result = await runGeoSearch('| inputlookup geo_points_us_eu_hierarchy.csv | fields snapshot continent country state county city lat lon value label category source')
        setSnapshots(result.snapshots)
        setAutoplay(result.snapshots.length > 1)
        setSelectedFrame(0)
        setDataRefreshedAt(new Date().toISOString())
        setStatus('idle')
      } catch (e) {
        setStatus('error')
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    void load()
  }, [])

  useEffect(() => {
    async function loadRegionLayers() {
      try {
        const levels = [...LEVEL_ORDER]
        const results = await Promise.all(
          levels.map(async (level) => {
            const response = await fetch(getRegionLayerUrl(level), { credentials: 'same-origin' })
            if (!response.ok) {
              throw new Error(`Unable to load ${level}.geojson (${response.status})`)
            }
            const payload = (await response.json()) as { features?: RegionLayerFeature[] }
            return [level, payload.features || []] as const
          }),
        )

        setRegionLayerByLevel(
          results.reduce((acc, [level, features]) => {
            acc[level] = features
            return acc
          }, {} as Partial<Record<Level, RegionLayerFeature[]>>),
        )
        setLayersRefreshedAt(new Date().toISOString())
      } catch (e) {
        setError((prev) => (prev ? `${prev}\n${String(e)}` : String(e)))
      }
    }
    void loadRegionLayers()
  }, [])

  useEffect(() => {
    let canceled = false
    async function loadOrbitalDatasets() {
      const catalogUrl = getOrbitalDatasetUrl('catalog.json')
      const timeseriesUrl = getOrbitalDatasetUrl('timeseries-latest.json')

      const [catalogResult, timeseriesResult] = await Promise.allSettled([
        fetch(catalogUrl, { credentials: 'same-origin' }),
        fetch(timeseriesUrl, { credentials: 'same-origin' }),
      ])

      const nextErrors: string[] = []
      const catalogRows: OrbitalDatasetObject[] = []
      const timeseriesRows: OrbitalDatasetObject[] = []

      if (catalogResult.status === 'fulfilled') {
        if (catalogResult.value.ok) {
          const payload = await catalogResult.value.json()
          catalogRows.push(...parseOrbitalDatasetObjects(payload))
        } else if (catalogResult.value.status !== 404) {
          nextErrors.push(`Unable to load orbital catalog (${catalogResult.value.status})`)
        }
      } else {
        nextErrors.push(`Unable to load orbital catalog (${String(catalogResult.reason)})`)
      }

      if (timeseriesResult.status === 'fulfilled') {
        if (timeseriesResult.value.ok) {
          const payload = await timeseriesResult.value.json()
          timeseriesRows.push(...parseOrbitalDatasetObjects(payload))
        } else if (timeseriesResult.value.status !== 404) {
          nextErrors.push(`Unable to load orbital timeseries (${timeseriesResult.value.status})`)
        }
      } else {
        nextErrors.push(`Unable to load orbital timeseries (${String(timeseriesResult.reason)})`)
      }

      if (canceled) return
      setOrbitalCatalog(catalogRows)
      setOrbitalTimeseries(timeseriesRows)
      if (nextErrors.length) {
        setError((prev) => (prev ? `${prev}\n${nextErrors.join('\n')}` : nextErrors.join('\n')))
      }
    }
    void loadOrbitalDatasets()
    return () => {
      canceled = true
    }
  }, [])

  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return
    const message: NextGenMessage = {
      type: 'splunk-nextgen:data',
      payload: {
        title: 'Geo Intelligence',
        subtitle: `${frames.reduce((sum, frame) => sum + frame.points.length, 0)} rendered points • level: ${activeLevel} • spikes: ${renderPointLevel}`,
        frames,
        playback: {
          autoplay,
          speedMs,
          selectedFrame: clamp(selectedFrame, 0, Math.max(0, frames.length - 1)),
        },
        view: {
          activeLevel,
          earthStyle,
          backgroundStyle,
          baseVisual,
          contextTheme,
          regionQualityDebug: showRegionQualityDebug,
          regionLowQualityOnly: showRegionQualityDebug && showOnlyLowQualityRegions,
          regionTriageMode: showRegionQualityDebug ? regionTriageMode : 'all',
          pointIntensity,
          pointOpacity,
          showRegionHighlight,
          showFocusLabel,
          autoRotate,
          autoRotateSpeed,
          zoomScale,
        },
        focus: focusPayload,
        highlights: showRegionHighlight ? highlights : [],
        regionLayer,
        contextLayer: showContextLayer ? contextLayer : null,
        connections: {
          enabled: showConnections,
          arcs: showConnections ? connectionArcs : [],
        },
        flow: {
          enabled: showFlow,
          vectors: showFlow ? flowVectors : [],
        },
        grouping: {
          enabled: showGrouping,
          clusters: showGrouping ? groupedClusters : [],
        },
        temperature: {
          enabled: showTemperature,
          layer: showTemperature ? temperatureLayer : null,
        },
        anchor: {
          enabled: showAnchorRelated,
          layer: showAnchorRelated ? anchorLayer : null,
        },
        groundHeat: {
          enabled: showGroundHeat,
          cells: showGroundHeat ? groundHeatCells : [],
        },
        nonTerrestrial: {
          enabled: showNonTerrestrial,
          objects: showNonTerrestrial ? nonTerrestrialObjects : [],
          sourceSummary: nonTerrestrialSourceSummary,
          launchEventMode,
          datasetSummary: nonTerrestrialDatasetSummary,
        },
        ops: {
          confidence: operationalConfidence,
          provenance: operationalProvenanceResolved,
          telemetry: {
            dataAgeSec,
            staleWarnSec: operationalTelemetryThresholds.staleWarnSec,
            staleCriticalSec: operationalTelemetryThresholds.staleCriticalSec,
            renderWarnMs: operationalTelemetryThresholds.renderWarnMs,
            renderCriticalMs: operationalTelemetryThresholds.renderCriticalMs,
          },
        },
      },
    }
    iframeRef.current.contentWindow?.postMessage(message, '*')
  }, [
    iframeReady,
    frames,
    autoplay,
    speedMs,
    selectedFrame,
    earthStyle,
    backgroundStyle,
    baseVisual,
    contextTheme,
    showRegionQualityDebug,
    showOnlyLowQualityRegions,
    regionTriageMode,
    pointIntensity,
    pointOpacity,
    showRegionHighlight,
    showContextLayer,
    showFocusLabel,
    autoRotate,
    autoRotateSpeed,
    zoomScale,
    focusPayload,
    highlights,
    regionLayer,
    contextLayer,
    activeLevel,
    renderPointLevel,
    showConnections,
    connectionArcs,
    showFlow,
    flowVectors,
    showGrouping,
    groupedClusters,
    showTemperature,
    temperatureLayer,
    showAnchorRelated,
    anchorLayer,
    showGroundHeat,
    groundHeatCells,
    showNonTerrestrial,
    launchEventMode,
    nonTerrestrialObjects,
    nonTerrestrialSourceSummary,
    nonTerrestrialDatasetSummary,
    operationalConfidence,
    operationalProvenanceResolved,
    dataAgeSec,
    operationalTelemetryThresholds,
  ])

  return (
    <div
      style={{
        marginTop: fullView ? 0 : 12,
        display: 'grid',
        gridTemplateRows: fullView ? 'auto 1fr' : undefined,
        gap: 12,
        height: fullView ? 'calc(100vh - 16px)' : 'auto',
        overflow: fullView ? 'hidden' : 'visible',
        position: fullView ? 'fixed' : 'static',
        inset: fullView ? 8 : undefined,
        zIndex: fullView ? 1200 : 'auto',
        background: fullView ? 'rgba(2,6,23,0.98)' : undefined,
        borderRadius: fullView ? 14 : undefined,
        padding: fullView ? 8 : undefined,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(2,6,23,0.9))', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 16, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.6 }}>Globe Intelligence</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSettingsCollapsed((prev) => !prev)}>{settingsCollapsed ? 'Expand settings' : 'Collapse settings'}</button>
            <button onClick={() => setFullView((prev) => !prev)}>{fullView ? 'Exit full view' : 'Full view'}</button>
          </div>
        </div>
        <div style={{ marginTop: 6, color: '#93c5fd', fontSize: 12 }}>Reimagined exploration: multi-level regional drilldown, zoom-to-area, richer visuals, and interaction-first rendering.</div>

        {!settingsCollapsed ? <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
          <div style={{ background: '#020617', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: 10 }}>
            <label style={{ color: '#93c5fd', fontSize: 12 }}>Hierarchy level</label>
            <select value={activeLevel} onChange={(e) => setActiveLevel(e.target.value as Level)} style={{ marginTop: 5, width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '6px 8px' }}>
              <option value="continent">Continent</option>
              <option value="country">Country</option>
              <option value="state">State / Province</option>
              <option value="county">County / District</option>
              <option value="city">City / Town</option>
            </select>
          </div>

          <div style={{ background: '#020617', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: 10 }}>
            <label style={{ color: '#93c5fd', fontSize: 12 }}>Earth style</label>
            <select value={earthStyle} onChange={(e) => setEarthStyle(e.target.value as 'grey' | 'blueprint' | 'atlas' | 'neon')} style={{ marginTop: 5, width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '6px 8px' }}>
              <option value="grey">Grey (normal)</option>
              <option value="blueprint">Blueprint</option>
              <option value="atlas">Atlas (old map)</option>
              <option value="neon">Neon Pulse</option>
            </select>
            <label style={{ color: '#93c5fd', fontSize: 12, marginTop: 8, display: 'block' }}>Context theme</label>
            <select value={contextTheme} onChange={(e) => setContextTheme(e.target.value as ContextTheme)} style={{ marginTop: 4, width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '6px 8px' }}>
              <option value="subtle-cyan">Subtle cyan</option>
              <option value="amber-contrast">Amber contrast</option>
              <option value="violet-night">Violet night</option>
            </select>
          </div>

          <div style={{ background: '#020617', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: 10 }}>
            <label style={{ color: '#93c5fd', fontSize: 12 }}>Background</label>
            <select value={backgroundStyle} onChange={(e) => setBackgroundStyle(e.target.value as 'deep-space' | 'black' | 'steel')} style={{ marginTop: 5, width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '6px 8px' }}>
              <option value="deep-space">Deep Space</option>
              <option value="black">Black</option>
              <option value="steel">Steel</option>
            </select>
          </div>

          <div style={{ background: '#020617', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: 10 }}>
            <label style={{ color: '#93c5fd', fontSize: 12 }}>Point intensity</label>
            <input type="range" min={0.6} max={2} step={0.1} value={pointIntensity} onChange={(e) => setPointIntensity(Number.parseFloat(e.target.value) || 1)} />
            <label style={{ color: '#93c5fd', fontSize: 12 }}>Point opacity</label>
            <input type="range" min={0.4} max={1} step={0.05} value={pointOpacity} onChange={(e) => setPointOpacity(Number.parseFloat(e.target.value) || 0.95)} />
            <label style={{ color: '#93c5fd', fontSize: 12, marginTop: 6, display: 'block' }}>Base visual</label>
            <select value={baseVisual} onChange={(e) => setBaseVisual(e.target.value as 'spikes' | 'dots' | 'hybrid')} style={{ marginTop: 4, width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '6px 8px' }}>
              <option value="hybrid">Hybrid (spikes + dots)</option>
              <option value="spikes">Spikes</option>
              <option value="dots">Surface dots</option>
            </select>
          </div>

          <div style={{ background: '#020617', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: 10 }}>
            <label style={{ color: '#93c5fd', fontSize: 12 }}>Min value</label>
            <input type="number" min={0} step={1} value={minValue} onChange={(e) => setMinValue(Number.parseFloat(e.target.value) || 0)} style={{ marginTop: 5, width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '6px 8px' }} />
            <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
              <label style={{ color: '#93c5fd', fontSize: 12 }}><input type="checkbox" checked={showRegionHighlight} onChange={(e) => setShowRegionHighlight(e.target.checked)} /> Highlight selected region</label>
              <label style={{ color: '#93c5fd', fontSize: 12 }}><input type="checkbox" checked={showContextLayer} onChange={(e) => setShowContextLayer(e.target.checked)} /> Show context layer</label>
              <label style={{ color: '#93c5fd', fontSize: 12 }}><input type="checkbox" checked={showRegionQualityDebug} onChange={(e) => setShowRegionQualityDebug(e.target.checked)} /> Region quality debug</label>
              <label style={{ color: '#93c5fd', fontSize: 12, opacity: showRegionQualityDebug ? 1 : 0.55 }}><input type="checkbox" checked={showOnlyLowQualityRegions} onChange={(e) => setShowOnlyLowQualityRegions(e.target.checked)} disabled={!showRegionQualityDebug} /> Low-quality regions only</label>
              <label style={{ color: '#93c5fd', fontSize: 12, opacity: showRegionQualityDebug ? 1 : 0.55 }}>Triage mode</label>
              <select
                value={regionTriageMode}
                onChange={(e) => setRegionTriageMode(e.target.value as 'all' | 'low-quality' | 'bbox-fallback' | 'degenerate')}
                disabled={!showRegionQualityDebug}
                style={{ width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '6px 8px', opacity: showRegionQualityDebug ? 1 : 0.55 }}
              >
                <option value="all">All regions</option>
                <option value="low-quality">Low quality only</option>
                <option value="bbox-fallback">BBox fallback only</option>
                <option value="degenerate">Degenerate fallback only</option>
              </select>
              <label style={{ color: '#93c5fd', fontSize: 12 }}><input type="checkbox" checked={showFocusLabel} onChange={(e) => setShowFocusLabel(e.target.checked)} /> Focus label</label>
              <label style={{ color: '#93c5fd', fontSize: 12 }}><input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} /> Auto-rotate</label>
            </div>
            <input type="range" min={0.005} max={0.12} step={0.005} value={autoRotateSpeed} onChange={(e) => setAutoRotateSpeed(Number.parseFloat(e.target.value) || 0.06)} disabled={!autoRotate} />
          </div>

          <div style={{ background: '#020617', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: 10 }}>
            <div style={{ color: '#93c5fd', fontSize: 12, marginBottom: 6 }}>Connectivity + flow</div>
            <div style={{ display: 'grid', gap: 5 }}>
              <label style={{ color: '#93c5fd', fontSize: 12 }}><input type="checkbox" checked={showConnections} onChange={(e) => setShowConnections(e.target.checked)} /> Connection arcs</label>
              <label style={{ color: '#93c5fd', fontSize: 12 }}><input type="checkbox" checked={showFlow} onChange={(e) => setShowFlow(e.target.checked)} /> Flow vectors</label>
              <label style={{ color: '#93c5fd', fontSize: 12 }}><input type="checkbox" checked={showAnchorRelated} onChange={(e) => setShowAnchorRelated(e.target.checked)} /> Anchor-related points</label>
            </div>
            <label style={{ color: '#93c5fd', fontSize: 12, marginTop: 8, display: 'block' }}>Arc mode</label>
            <select value={connectionMode} onChange={(e) => setConnectionMode(e.target.value as 'hub' | 'sequential')} style={{ marginTop: 4, width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '6px 8px' }}>
              <option value="hub">Hub to peers</option>
              <option value="sequential">Peer chain</option>
            </select>
            <label style={{ color: '#93c5fd', fontSize: 12, marginTop: 8, display: 'block' }}>Arc scope</label>
            <select value={connectionScope} onChange={(e) => setConnectionScope(e.target.value as 'all' | 'intra-region' | 'inter-region')} style={{ marginTop: 4, width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '6px 8px' }}>
              <option value="all">All peers</option>
              <option value="intra-region">Intra-region only</option>
              <option value="inter-region">Inter-region only</option>
            </select>
            <label style={{ color: '#93c5fd', fontSize: 12, marginTop: 8, display: 'block' }}>Arc grouping filter</label>
            <select value={connectionGroupFilter} onChange={(e) => setConnectionGroupFilter(e.target.value as 'none' | 'source' | 'category' | 'continent')} style={{ marginTop: 4, width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '6px 8px' }}>
              <option value="none">None</option>
              <option value="source">Match source</option>
              <option value="category">Match category</option>
              <option value="continent">Match continent</option>
            </select>
            <label style={{ color: '#93c5fd', fontSize: 12, marginTop: 8, display: 'block' }}>Max links: {maxConnections}</label>
            <input type="range" min={3} max={20} step={1} value={maxConnections} onChange={(e) => setMaxConnections(Number.parseInt(e.target.value, 10) || 8)} />
            <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 11 }}>
              Peers {connectionFilterStats.totalPeers} → scope {connectionFilterStats.scopePeers} → group {connectionFilterStats.groupPeers} → arcs {connectionFilterStats.renderedArcs}
            </div>
          </div>

          <div style={{ background: '#020617', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: 10 }}>
            <div style={{ color: '#93c5fd', fontSize: 12, marginBottom: 6 }}>Grouping + thermal layers</div>
            <div style={{ display: 'grid', gap: 5 }}>
              <label style={{ color: '#93c5fd', fontSize: 12 }}><input type="checkbox" checked={showGrouping} onChange={(e) => setShowGrouping(e.target.checked)} /> Grouped markers</label>
              <label style={{ color: '#93c5fd', fontSize: 12 }}><input type="checkbox" checked={showTemperature} onChange={(e) => setShowTemperature(e.target.checked)} /> Temperature bands</label>
              <label style={{ color: '#93c5fd', fontSize: 12 }}><input type="checkbox" checked={showGroundHeat} onChange={(e) => setShowGroundHeat(e.target.checked)} /> Ground heat map</label>
            </div>
            <label style={{ color: '#93c5fd', fontSize: 12, marginTop: 8, display: 'block' }}>Group mode</label>
            <select value={groupMode} onChange={(e) => setGroupMode(e.target.value as 'source' | 'category' | 'continent')} style={{ marginTop: 4, width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '6px 8px' }}>
              <option value="source">By source</option>
              <option value="category">By category</option>
              <option value="continent">By continent</option>
            </select>
            <label style={{ color: '#93c5fd', fontSize: 12, marginTop: 8, display: 'block' }}>Cold threshold: {coldThreshold.toFixed(2)}</label>
            <input type="range" min={0.1} max={0.7} step={0.02} value={coldThreshold} onChange={(e) => setColdThreshold(Number.parseFloat(e.target.value) || 0.28)} />
            <label style={{ color: '#93c5fd', fontSize: 12, marginTop: 6, display: 'block' }}>Hot threshold: {hotThreshold.toFixed(2)}</label>
            <input type="range" min={0.3} max={0.95} step={0.02} value={hotThreshold} onChange={(e) => setHotThreshold(Number.parseFloat(e.target.value) || 0.72)} />
          </div>

          <div style={{ background: '#020617', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: 10 }}>
            <div style={{ color: '#93c5fd', fontSize: 12, marginBottom: 6 }}>Orbital objects (demo wow switch)</div>
            <label style={{ color: '#93c5fd', fontSize: 12 }}>
              <input type="checkbox" checked={showNonTerrestrial} onChange={(e) => setShowNonTerrestrial(e.target.checked)} /> Show non-terrestrial tracked objects
            </label>
            <label style={{ color: '#93c5fd', fontSize: 12, display: 'block', marginTop: 6 }}>
              <input type="checkbox" checked={launchEventMode} onChange={(e) => setLaunchEventMode(e.target.checked)} /> Launch event mode
            </label>
            <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 11 }}>
              {showNonTerrestrial
                ? `${nonTerrestrialObjects.length} objects • ${nonTerrestrialSourceSummary || 'mixed sources'}`
                : 'Off by default for standard operations'}
            </div>
            <div style={{ marginTop: 4, color: '#94a3b8', fontSize: 11 }}>Dataset: {nonTerrestrialDatasetSummary}</div>
          </div>
        </div> : null}
      </div>

      {error ? <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: 10, color: '#fecaca' }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12, minHeight: 0, height: fullView ? '100%' : 'auto' }}>
        <div style={{ border: '1px solid rgba(56,189,248,0.25)', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
          <iframe ref={iframeRef} src={getEmbedUrl()} title="Globe Intelligence" onLoad={() => setIframeReady(true)} style={{ width: '100%', height: frameHeight, border: 0, display: 'block' }} />
        </div>

        <div style={{ background: 'rgba(15,23,42,0.76)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 16, padding: 12, maxHeight: frameHeight, overflow: 'auto' }}>
          <div style={{ fontWeight: 700, color: '#e2e8f0' }}>Region Drilldown</div>
          <div style={{ marginTop: 6, color: '#93c5fd', fontSize: 12 }}>{status === 'loading' ? 'Loading points...' : `${hierarchyNodes.length} ${activeLevel} nodes`}</div>

          <div style={{ marginTop: 8, background: '#010a1a', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 10, padding: 8 }}>
            <div style={{ color: '#93c5fd', fontSize: 12, marginBottom: 6 }}>Location search</div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const exact = knownLocationById.get(locationSelectionId)
                if (exact) {
                  focusKnownLocation(exact)
                  return
                }
                focusKnownLocation(filteredLocationOptions[0] ?? null)
              }}
              style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}
            >
              <input
                list="known-location-options"
                value={locationQuery}
                placeholder="Search known location..."
                onChange={(event) => {
                  const next = event.target.value
                  setLocationQuery(next)
                  const matched = knownLocationByDisplay.get(next)
                  setLocationSelectionId(matched?.id || '')
                }}
                style={{ width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '6px 8px' }}
              />
              <button type="submit" disabled={!filteredLocationOptions.length} style={{ padding: '6px 10px' }}>Go</button>
            </form>
            <datalist id="known-location-options">
              {filteredLocationOptions.map((option) => (
                <option key={option.id} value={option.display} />
              ))}
            </datalist>
            <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 11 }}>
              {filteredLocationOptions.length ? `${filteredLocationOptions.length} known matches` : 'No known location matches'}
            </div>
          </div>

          <div style={{ marginTop: 8, background: '#020617', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 8 }}>
            <div style={{ color: '#93c5fd', fontSize: 12, marginBottom: 6 }}>Selected region quality</div>
            <div style={{ color: '#bfdbfe', fontSize: 11, marginBottom: 6 }}>
              Unresolved total: {layerQualitySummary.totalUnresolved}/{layerQualitySummary.totalFeatures} • low-quality: {layerQualitySummary.totalLow} • fallback: {layerQualitySummary.totalFallback}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button onClick={() => exportUnresolvedRegionsReport('json')} style={{ fontSize: 11, padding: '4px 8px' }}>Export unresolved JSON</button>
              <button onClick={() => exportUnresolvedRegionsReport('csv')} style={{ fontSize: 11, padding: '4px 8px' }}>Export unresolved CSV</button>
            </div>
            {selectedRegionFeature ? (
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12 }}>{selectedRegionFeature.label}</div>
                <div style={{ color: '#bfdbfe', fontSize: 11 }}>Strategy: {selectedRegionFeature.geometryStrategy}</div>
                <div style={{ color: '#bfdbfe', fontSize: 11 }}>Quality score: {selectedRegionFeature.qualityScore.toFixed(2)}</div>
                <div style={{ color: '#bfdbfe', fontSize: 11 }}>Source points: {selectedRegionFeature.sourcePointCount}</div>
                <div style={{ color: '#bfdbfe', fontSize: 11 }}>Hull vertices: {selectedRegionFeature.hullVertexCount}</div>
                <div style={{ color: '#bfdbfe', fontSize: 11 }}>Polygon paths: {selectedRegionFeature.paths.length}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={() => exportRegionTriage('json')} style={{ fontSize: 11, padding: '4px 8px' }}>Export triage JSON</button>
                  <button onClick={() => exportRegionTriage('csv')} style={{ fontSize: 11, padding: '4px 8px' }}>Export triage CSV</button>
                </div>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Select a region to inspect geometry quality details.</div>
            )}
          </div>

          <div style={{ marginTop: 8, background: '#020617', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 8 }}>
            <div style={{ color: '#93c5fd', fontSize: 12, marginBottom: 6 }}>Operational confidence</div>
            <div style={{ color: '#bfdbfe', fontSize: 11, marginBottom: 6 }}>
              Overall {(operationalConfidence.overall * 100).toFixed(0)}% ({telemetryState.confidence}) • stale state: {telemetryState.stale}
            </div>
            <div style={{ display: 'grid', gap: 3, marginBottom: 8 }}>
              <div style={{ color: '#bfdbfe', fontSize: 11 }}>Region confidence: {(operationalConfidence.region * 100).toFixed(0)}%</div>
              <div style={{ color: '#bfdbfe', fontSize: 11 }}>Context confidence: {(operationalConfidence.context * 100).toFixed(0)}%</div>
              <div style={{ color: '#bfdbfe', fontSize: 11 }}>Arc confidence: {(operationalConfidence.arcs * 100).toFixed(0)}%</div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Data age: {formatDuration(dataAgeSec)} (warn {formatDuration(operationalTelemetryThresholds.staleWarnSec)}, critical {formatDuration(operationalTelemetryThresholds.staleCriticalSec)})</div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Source: {operationalProvenanceResolved.source}</div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Data refreshed: {formatTimestamp(operationalProvenanceResolved.dataRefreshedAt)}</div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Layers refreshed: {formatTimestamp(operationalProvenanceResolved.layersRefreshedAt)}</div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>
                Registry healthy/warn/critical: {operationalProvenanceResolved.registrySummary.healthy}/{operationalProvenanceResolved.registrySummary.warning}/{operationalProvenanceResolved.registrySummary.critical}
              </div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>
                Pilot adapter: {operationalProvenanceResolved.pilotAdapter.id} ({operationalProvenanceResolved.pilotAdapter.status})
              </div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>
                Adapter samples: {operationalProvenanceResolved.pilotAdapter.sampleCount} • checked {formatTimestamp(operationalProvenanceResolved.pilotAdapter.checkedAt)}
              </div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>
                Top risk layers: {operationalProvenanceResolved.layers
                  .slice()
                  .sort((left, right) => left.confidence - right.confidence)
                  .slice(0, 3)
                  .map((layer) => `${layer.label}(${(layer.confidence * 100).toFixed(0)}%)`)
                  .join(', ')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => exportOperationalSnapshot('json')} style={{ fontSize: 11, padding: '4px 8px' }}>Export ops JSON</button>
              <button onClick={() => exportOperationalSnapshot('csv')} style={{ fontSize: 11, padding: '4px 8px' }}>Export ops CSV</button>
            </div>
          </div>

          <div style={{ marginTop: 8, background: '#020617', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 8 }}>
            <div style={{ color: '#93c5fd', fontSize: 12, marginBottom: 6 }}>Playback</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setAutoplay((prev) => !prev)} disabled={frames.length <= 1}>{autoplay ? 'Pause' : 'Play'}</button>
              <select value={String(speedMs)} onChange={(e) => setSpeedMs(Number.parseInt(e.target.value, 10) || 1300)} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '4px 6px' }}>
                <option value="800">2x</option>
                <option value="1300">1x</option>
                <option value="2200">0.5x</option>
              </select>
              <input type="range" min={0} max={Math.max(0, frames.length - 1)} value={clamp(selectedFrame, 0, Math.max(0, frames.length - 1))} onChange={(e) => { setSelectedFrame(Number.parseInt(e.target.value, 10) || 0); setAutoplay(false) }} disabled={frames.length <= 1} />
              <div style={{ color: '#e2e8f0', fontSize: 12 }}>{frames[selectedFrameClamped]?.name ?? '(none)'}</div>
            </div>
          </div>

          <div style={{ marginTop: 8, background: '#020617', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 8 }}>
            <div style={{ color: '#93c5fd', fontSize: 12, marginBottom: 6 }}>Path filters</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {selectedTrail.length ? (
                selectedTrail.map((item) => (
                  <button
                    key={item.level}
                    onClick={() => jumpToTrailLevel(item.level)}
                    style={{
                      background: 'rgba(56,189,248,0.18)',
                      border: '1px solid rgba(56,189,248,0.45)',
                      borderRadius: 999,
                      color: '#dbeafe',
                      fontSize: 11,
                      padding: '3px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    {item.level}: {item.label}
                  </button>
                ))
              ) : (
                <span style={{ color: '#94a3b8', fontSize: 11 }}>No selected path yet</span>
              )}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {LEVEL_ORDER.map((level) => {
                const selected = selectedPath[level]
                return (
                  <div key={level} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8', fontSize: 11, textTransform: 'capitalize' }}>{level}</span>
                    <span style={{ color: '#e2e8f0', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{selected || '(all)'}</span>
                  </div>
                )
              })}
            </div>
            <button
              style={{ marginTop: 8, cursor: 'pointer' }}
              onClick={stepBackOneLevel}
              disabled={LEVEL_ORDER.indexOf(activeLevel) === 0}
            >
              Step back one level
            </button>
            <button
              style={{ marginTop: 8, cursor: 'pointer' }}
              onClick={() => {
                resetDrilldown()
              }}
            >
              Clear all filters
            </button>
          </div>

          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            {hierarchyNodes.slice(0, 40).map((node) => (
              <button
                key={node.key}
                onClick={() => selectNodeAndDrill(node)}
                style={{
                  textAlign: 'left',
                  background: activeNodeKey === node.key ? 'rgba(56,189,248,0.18)' : '#020617',
                  border: '1px solid rgba(148,163,184,0.22)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700 }}>{node.name}</div>
                <div style={{ marginTop: 2, color: '#93c5fd', fontSize: 11 }}>{node.count} pts • total {node.total.toFixed(1)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
