export type SplunkFetchOptions = {
  method?: 'GET' | 'POST' | 'DELETE'
  path: string
  query?: Record<string, string | number | boolean | undefined>
  form?: Record<string, string | number | boolean | undefined>
  json?: unknown
  signal?: AbortSignal
}

function toQueryString(query: NonNullable<SplunkFetchOptions['query']>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v == null) continue
    p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

function toFormBody(form: NonNullable<SplunkFetchOptions['form']>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(form)) {
    if (v == null) continue
    p.set(k, String(v))
  }
  return p
}

export async function splunkFetchJSON<T>(opts: SplunkFetchOptions): Promise<T | null> {
  const method = opts.method ?? (opts.form ? 'POST' : 'GET')

  const qs = opts.query ? toQueryString(opts.query) : ''
  const url = `${opts.path}${qs}`

  const headers: Record<string, string> = {}
  headers['X-Requested-With'] = 'XMLHttpRequest'

  if (method !== 'GET') {
    try {
      const w = window as unknown as { Splunk?: { util?: { getFormKey?: unknown } } }
      const getFormKey = w.Splunk?.util?.getFormKey
      if (typeof getFormKey === 'function') {
        const key = (getFormKey as () => string)()
        if (key) headers['X-Splunk-Form-Key'] = key
      }
    } catch {
      // ignore
    }
  }

  if (opts.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
  }

  if (opts.json != null) {
    headers['Content-Type'] = 'application/json; charset=UTF-8'
  }

  const res = await fetch(url, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: opts.json != null ? JSON.stringify(opts.json) : opts.form ? toFormBody(opts.form) : undefined,
    signal: opts.signal,
    credentials: 'same-origin',
  })

  const text = await res.text().catch(() => '')

  if (!res.ok) {
    throw new Error(`Splunk fetch failed: ${res.status} ${res.statusText}${text ? `\n${text}` : ''}`)
  }

  if (!text || !text.trim()) return null

  try {
    return JSON.parse(text) as T
  } catch (e) {
    const ct = res.headers.get('content-type') ?? '(unknown)'
    const prefix = text.slice(0, 300)
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Failed to parse JSON from Splunk response (${msg}).\ncontent-type: ${ct}\nbody (prefix): ${prefix}`)
  }
}

function tryGetLocalePrefix(): string {
  // Most Splunk Web paths begin with /<locale>/..., e.g. /en-US/app/... or /en-US/manager/...
  // When Splunk.util.make_url is unavailable and <base href="/en-US/"> isn't present,
  // derive the locale from the current location.
  try {
    const parts = window.location.pathname.split('/').filter(Boolean)
    const first = parts[0] || ''
    if (first && first.includes('-')) return `/${first}`
  } catch {
    // ignore
  }
  return ''
}

export function getSplunkCustomControllerBasePath(app: string, controller: string) {
  // Splunk Web controller endpoints are served under /<locale>/custom/<app>/<controller>/...
  try {
    const w = window as unknown as { Splunk?: { util?: { make_url?: unknown } } }
    const makeUrl = w.Splunk?.util?.make_url
    if (typeof makeUrl === 'function') {
      const path = (makeUrl as (p: string) => string)(`custom/${app}/${controller}`)
      return path.replace(/\/+$/, '')
    }
  } catch {
    // ignore
  }

  const locale = tryGetLocalePrefix()
  if (locale) return `${locale}/custom/${app}/${controller}`

  try {
    const u = new URL(`custom/${app}/${controller}`, document.baseURI)
    return u.pathname.replace(/\/+$/, '')
  } catch {
    // ignore
  }

  return `/custom/${app}/${controller}`
}

export function getSplunkServicesBasePath() {
  try {
    const w = window as unknown as { Splunk?: { util?: { make_url?: unknown } } }
    const makeUrl = w.Splunk?.util?.make_url
    if (typeof makeUrl === 'function') {
      const path = (makeUrl as (p: string) => string)('splunkd/__raw/services')
      return path.replace(/\/+$/, '')
    }
  } catch {
    // ignore
  }

  // Prefer locale-derived absolute path.
  const locale = tryGetLocalePrefix()
  if (locale) return `${locale}/splunkd/__raw/services`

  // Fallback: attempt relative to document.baseURI.
  try {
    const u = new URL('splunkd/__raw/services', document.baseURI)
    return u.pathname.replace(/\/+$/, '')
  } catch {
    // ignore
  }

  return '/splunkd/__raw/services'
}

export function getSplunkServicesNSBasePath(app: string) {
  try {
    const w = window as unknown as { Splunk?: { util?: { make_url?: unknown } } }
    const makeUrl = w.Splunk?.util?.make_url
    if (typeof makeUrl === 'function') {
      const path = (makeUrl as (p: string) => string)(`splunkd/__raw/servicesNS/nobody/${app}`)
      return path.replace(/\/+$/, '')
    }
  } catch {
    // ignore
  }

  const locale = tryGetLocalePrefix()
  if (locale) return `${locale}/splunkd/__raw/servicesNS/nobody/${app}`

  try {
    const u = new URL(`splunkd/__raw/servicesNS/nobody/${app}`, document.baseURI)
    return u.pathname.replace(/\/+$/, '')
  } catch {
    // ignore
  }

  return `/splunkd/__raw/servicesNS/nobody/${app}`
}
