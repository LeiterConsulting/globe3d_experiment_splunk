import { getSplunkServicesNSBasePath, splunkFetchJSON } from './llmProxySdk/splunkFetch'

const APP = (import.meta.env.VITE_SPLUNK_APP_ID as string | undefined) || 'splunk_globe_app'

export type GeoPoint = {
  lat: number
  lon: number
  value: number
  label?: string
  category?: string
  source?: string
  continent?: string
  country?: string
  state?: string
  county?: string
  city?: string
}

export type GeoSnapshot = {
  name: string
  points: GeoPoint[]
}

export const DEFAULT_GEO_SEARCH = '| inputlookup geo_points_timeseries_demo.csv | fields snapshot lat lon value label'

type SearchJobCreateResponse = {
  sid?: string
  entry?: Array<{ name?: string }>
}

type SearchJobResultsResponse = {
  results?: Array<Record<string, unknown>>
}

type SearchJobStatusResponse = {
  entry?: Array<{
    content?: {
      dispatchState?: string
    }
    messages?: Array<{
      type?: string
      text?: string
    }>
  }>
}

type GeoSearchResult = {
  sid: string
  snapshots: GeoSnapshot[]
  points: GeoPoint[]
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

function pickValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] != null) return row[key]
  }
  return null
}

function readPoint(row: Record<string, unknown>): GeoPoint | null {
  const lat = toNumber(pickValue(row, ['lat', 'latitude']))
  const lon = toNumber(pickValue(row, ['lon', 'lng', 'longitude']))
  if (lat == null || lon == null) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null

  const valueRaw = pickValue(row, ['value', 'count', 'metric', 'population'])
  const value = toNumber(valueRaw) ?? 1
  const labelRaw = pickValue(row, ['label', 'name', 'city', 'country'])
  const label = typeof labelRaw === 'string' ? labelRaw : undefined
  const categoryRaw = pickValue(row, ['category', 'series', 'group', 'type'])
  const category = typeof categoryRaw === 'string' ? categoryRaw : undefined
  const sourceRaw = pickValue(row, ['source', 'dataset', 'origin'])
  const source = typeof sourceRaw === 'string' ? sourceRaw : undefined
  const continentRaw = pickValue(row, ['continent'])
  const continent = typeof continentRaw === 'string' ? continentRaw : undefined
  const countryRaw = pickValue(row, ['country', 'nation'])
  const country = typeof countryRaw === 'string' ? countryRaw : undefined
  const stateRaw = pickValue(row, ['state', 'province', 'region'])
  const state = typeof stateRaw === 'string' ? stateRaw : undefined
  const countyRaw = pickValue(row, ['county', 'district'])
  const county = typeof countyRaw === 'string' ? countyRaw : undefined
  const cityRaw = pickValue(row, ['city', 'town', 'municipality'])
  const city = typeof cityRaw === 'string' ? cityRaw : undefined

  return { lat, lon, value: Math.max(0, value), label, category, source, continent, country, state, county, city }
}

function readSnapshotName(row: Record<string, unknown>): string {
  const value = pickValue(row, ['snapshot', 'time', 'period', '_time'])
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return 'Current'
}

function toTimestamp(raw: string): number | null {
  const ts = Date.parse(raw)
  return Number.isFinite(ts) ? ts : null
}

function sortSnapshots(snapshots: GeoSnapshot[]): GeoSnapshot[] {
  return [...snapshots].sort((left, right) => {
    const leftTs = toTimestamp(left.name)
    const rightTs = toTimestamp(right.name)
    if (leftTs != null && rightTs != null) return leftTs - rightTs
    if (leftTs != null) return -1
    if (rightTs != null) return 1
    return left.name.localeCompare(right.name)
  })
}

function extractSid(payload: SearchJobCreateResponse | null): string {
  const sid = payload?.sid || payload?.entry?.[0]?.name
  if (!sid) {
    throw new Error('Unable to read SID from Splunk search/jobs create response.')
  }
  return sid
}

async function fetchRowsFromPath(path: string): Promise<Array<Record<string, unknown>>> {
  const payload = await splunkFetchJSON<SearchJobResultsResponse>({
    path,
    query: {
      output_mode: 'json',
      count: 5000,
    },
  })
  return payload?.results || []
}

async function fetchSearchRowsWithFallbacks(services: string, sid: string): Promise<Array<Record<string, unknown>>> {
  const encodedSid = encodeURIComponent(sid)
  const candidates = [
    `${services}/search/jobs/${encodedSid}/results`,
    `${services}/search/jobs/${encodedSid}/results_preview`,
    `${services}/search/jobs/${encodedSid}/events`,
  ]

  for (const path of candidates) {
    try {
      const rows = await fetchRowsFromPath(path)
      if (rows.length) return rows
    } catch {
      // try next candidate
    }
  }

  return []
}

async function fetchJobDiagnostics(services: string, sid: string): Promise<string> {
  const payload = await splunkFetchJSON<SearchJobStatusResponse>({
    path: `${services}/search/jobs/${encodeURIComponent(sid)}`,
    query: { output_mode: 'json' },
  })

  const entry = payload?.entry?.[0]
  const state = entry?.content?.dispatchState || '(unknown dispatchState)'
  const messages = (entry?.messages || [])
    .map((msg) => `${msg.type || 'info'}: ${msg.text || ''}`.trim())
    .filter(Boolean)

  const messagesText = messages.length ? messages.join('\n') : '(no messages)'
  return `dispatchState: ${state}\nmessages:\n${messagesText}`
}

export async function runGeoSearch(search: string): Promise<GeoSearchResult> {
  const services = getSplunkServicesNSBasePath(APP)
  const trimmedSearch = search.trim()
  if (!trimmedSearch) {
    throw new Error('SPL query is empty.')
  }

  const create = await splunkFetchJSON<SearchJobCreateResponse>({
    path: `${services}/search/jobs`,
    method: 'POST',
    form: {
      output_mode: 'json',
      exec_mode: 'blocking',
      search: trimmedSearch,
    },
  })

  const sid = extractSid(create)

  try {
    const rows = await fetchSearchRowsWithFallbacks(services, sid)
    if (!rows.length) {
      const diag = await fetchJobDiagnostics(services, sid).catch(() => '(diagnostics unavailable)')
      throw new Error(
        `Search returned zero rows for SID ${sid}.\n` +
          `Check lookup visibility/permissions for app '${APP}'.\n` +
          `Diagnostics:\n${diag}`,
      )
    }

    const grouped = new Map<string, GeoPoint[]>()
    for (const row of rows) {
      const point = readPoint(row)
      if (!point) continue
      const snapshotName = readSnapshotName(row)
      const bucket = grouped.get(snapshotName)
      if (bucket) {
        bucket.push(point)
      } else {
        grouped.set(snapshotName, [point])
      }
    }

    const snapshots = sortSnapshots(
      [...grouped.entries()].map(([name, points]) => ({
        name,
        points,
      })),
    )

    const points = snapshots.flatMap((item) => item.points)

    return { sid, snapshots, points }
  } finally {
    await splunkFetchJSON<unknown>({
      path: `${services}/search/jobs/${encodeURIComponent(sid)}`,
      method: 'DELETE',
      query: { output_mode: 'json' },
    }).catch(() => null)
  }
}
