import { getSplunkCustomControllerBasePath, getSplunkServicesBasePath, getSplunkServicesNSBasePath, splunkFetchJSON } from './llmProxySdk/splunkFetch'

const APP = (import.meta.env.VITE_SPLUNK_APP_ID as string | undefined) || 'splunk_globe_app'

type Endpoint = {
  id: string
  host: string
  port: number
  description?: string
  enabled: boolean
  tags?: string[]
}

type ProbeResult = {
  ok: boolean
  detail: string
  ms?: number
}

type EndpointProbe = {
  endpoint_id: string
  host: string
  port: number
  probes: {
    dns: ProbeResult
    tcp: ProbeResult
    ssh_banner: ProbeResult
  }
}

type CapabilityResult = {
  ok: true
  user: string
  required_capability: string
  has_access: boolean
  capabilities: string[]
}

type EndpointsResult = {
  ok: true
  endpoints: Endpoint[]
  probes?: EndpointProbe[]
}

type ConnectResult = {
  ok: boolean
  can_connect: boolean
  reason?: string
  connection?: {
    type: string
    host: string
    port: number
    user: string
    ssh_uri: string
    launch?: {
      kind: string
      url?: string
      note?: string
    }
  }
}

function terminalPath(path = '') {
  return `${getSplunkServicesNSBasePath(APP)}/terminal${path}`
}

function terminalPathAppPrefixed(path = '') {
  return `${getSplunkServicesNSBasePath(APP)}/${APP}/terminal${path}`
}

function terminalPathServices(path = '') {
  return `${getSplunkServicesBasePath()}/terminal${path}`
}

function terminalPathServicesAppPrefixed(path = '') {
  return `${getSplunkServicesBasePath()}/${APP}/terminal${path}`
}

function terminalPathCustomController(path = '') {
  const base = getSplunkCustomControllerBasePath(APP, 'terminal_rest_proxy')
  return `${base}/services/${APP}/terminal${path}`
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message || ''
  return msg.includes('404') || msg.includes('Not Found')
}

async function fetchWithPathFallback<T>(pathSuffix: string, options: { method?: 'GET' | 'POST'; query?: Record<string, string>; form?: Record<string, string> } = {}) {
  const candidates = [
    terminalPathCustomController(pathSuffix),
    terminalPath(pathSuffix),
    terminalPathAppPrefixed(pathSuffix),
    terminalPathServices(pathSuffix),
    terminalPathServicesAppPrefixed(pathSuffix),
  ]

  let lastError: unknown = null
  const attempted: string[] = []
  for (const path of candidates) {
    attempted.push(path)
    try {
      return await splunkFetchJSON<T>({
        path,
        method: options.method,
        query: options.query,
        form: options.form,
      })
    } catch (error) {
      lastError = error
      if (!isNotFoundError(error)) throw error
    }
  }

  const attemptedText = attempted.join('\n')
  if (lastError instanceof Error) {
    throw new Error(`${lastError.message}\nAttempted paths:\n${attemptedText}`)
  }

  throw new Error(`All terminal endpoint path candidates failed\nAttempted paths:\n${attemptedText}`)
}

export async function getCapability(): Promise<CapabilityResult> {
  const res = await fetchWithPathFallback<CapabilityResult>('/capability', { query: { output_mode: 'json' } })
  if (!res) throw new Error('Empty capability response')
  return res
}

export async function getKnownEndpoints(withProbe = false): Promise<EndpointsResult> {
  const res = await fetchWithPathFallback<EndpointsResult>('/endpoints', {
    query: { output_mode: 'json', probe: withProbe ? 'true' : 'false' },
  })
  if (!res) throw new Error('Empty endpoints response')
  return res
}

export async function probeHost(host: string, port: number): Promise<EndpointProbe> {
  const res = await fetchWithPathFallback<EndpointProbe>('/probe', {
    method: 'POST',
    form: {
      host,
      port: String(port),
    },
  })
  if (!res) throw new Error('Empty probe response')
  return res
}

export async function connectHost(host: string, port: number): Promise<ConnectResult> {
  const res = await fetchWithPathFallback<ConnectResult>('/connect', {
    method: 'POST',
    form: {
      host,
      port: String(port),
    },
  })
  if (!res) throw new Error('Empty connect response')
  return res
}

export type { Endpoint, EndpointProbe, ProbeResult, CapabilityResult, ConnectResult }
