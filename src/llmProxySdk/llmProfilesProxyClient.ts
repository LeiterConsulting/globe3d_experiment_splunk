import { getSplunkServicesBasePath, getSplunkServicesNSBasePath, splunkFetchJSON } from './splunkFetch'

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type LlmProxyMeta = { 
  cfg_source?: 'profiles'
  effective_profile?: unknown
}

type LlmTestResponse = { ok: boolean; content?: string | null; raw?: unknown; error?: string } & LlmProxyMeta

type LlmChatResponse = { ok: boolean; content?: string | null; raw?: unknown; error?: string } & LlmProxyMeta

type LlmProfilesProxyPingResponse = { ok: true; path: string; method: string; secretRealm?: string }

type LlmProfileTargeting = {
  profile_id?: string
  app?: string
}


function profilesProxyServicesNSShortPath(path: string) {
  const base = getSplunkServicesNSBasePath('universal_llm_proxy')
  return `${base}/llm_profiles_proxy${path}`
}

function profilesProxyServicesNSAppPrefixedPath(path: string) {
  const base = getSplunkServicesNSBasePath('universal_llm_proxy')
  return `${base}/universal_llm_proxy/llm_profiles_proxy${path}`
}

function profilesProxyServicesPath(path: string) {
  const base = getSplunkServicesBasePath()
  return `${base}/universal_llm_proxy/llm_profiles_proxy${path}`
}


const EXPECTED_SECRET_REALM_PREFIX = 'universal_llm_proxy'

let cachedProfilesProxyBase: string | null = null

function candidatesPingPaths() {
  return [
    profilesProxyServicesPath('/ping'),
    profilesProxyServicesNSAppPrefixedPath('/ping'),
    profilesProxyServicesNSShortPath('/ping'),
  ]
}

function baseFromPingPath(pingPath: string) {
  return pingPath.replace(/\/ping$/, '')
}

function isAnyNotFound(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('404')
}

async function ensureProfilesProxyBase() {
  if (cachedProfilesProxyBase) return cachedProfilesProxyBase

  let lastErr: unknown = null
  for (const pingPath of candidatesPingPaths()) {
    try {
      const res = await splunkFetchJSON<LlmProfilesProxyPingResponse>({ path: pingPath, query: { output_mode: 'json' } })
      if (!res) throw new Error('Empty response')

      const realm = res.secretRealm || ''
      if (realm && !realm.startsWith(EXPECTED_SECRET_REALM_PREFIX)) {
        throw new Error(`404 Wrong llm_profiles_proxy handler (secretRealm=${realm})`)
      }

      cachedProfilesProxyBase = baseFromPingPath(pingPath)
      return cachedProfilesProxyBase
    } catch (e) {
      lastErr = e
    }
  }

  const lastMsg = lastErr instanceof Error ? lastErr.message : String(lastErr)
  throw new Error(`All LLM profiles proxy endpoints failed.\nTried:\n- ${candidatesPingPaths().join('\n- ')}\n\nLast error:\n${lastMsg}`)
}

export async function llmProfilesProxyPing() {
  const base = await ensureProfilesProxyBase()
  const res = await splunkFetchJSON<LlmProfilesProxyPingResponse>({ path: `${base}/ping`, query: { output_mode: 'json' } })
  if (!res) throw new Error('Empty response from LLM profiles proxy ping endpoint')
  return res
}

export async function llmProfilesProxyTest(prompt?: string, targeting?: LlmProfileTargeting) {
  const form: Record<string, string> = { prompt: prompt ?? '' }
  if (targeting?.profile_id) form.profile_id = targeting.profile_id
  if (targeting?.app) form.app = targeting.app

  let base = await ensureProfilesProxyBase()
  let res: LlmTestResponse | null = null
  try {
    res = await splunkFetchJSON<LlmTestResponse>({ path: `${base}/test`, method: 'POST', form })
  } catch (e) {
    if (isAnyNotFound(e)) {
      cachedProfilesProxyBase = null
      base = await ensureProfilesProxyBase()
      res = await splunkFetchJSON<LlmTestResponse>({ path: `${base}/test`, method: 'POST', form })
    } else {
      throw e
    }
  }
  if (!res) throw new Error('Empty response from LLM profiles proxy test endpoint')
  if (res.ok === false && res.error) throw new Error(res.error)
  return res
}

export async function llmProfilesProxyChat(messages: LlmMessage[], targeting?: LlmProfileTargeting) {
  const form: Record<string, string> = { messages: JSON.stringify(messages) }
  if (targeting?.profile_id) form.profile_id = targeting.profile_id
  if (targeting?.app) form.app = targeting.app

  let base = await ensureProfilesProxyBase()
  let res: LlmChatResponse | null = null
  try {
    res = await splunkFetchJSON<LlmChatResponse>({ path: `${base}/chat`, method: 'POST', form })
  } catch (e) {
    if (isAnyNotFound(e)) {
      cachedProfilesProxyBase = null
      base = await ensureProfilesProxyBase()
      res = await splunkFetchJSON<LlmChatResponse>({ path: `${base}/chat`, method: 'POST', form })
    } else {
      throw e
    }
  }
  if (!res) throw new Error('Empty response from LLM profiles proxy chat endpoint')
  if (res.ok === false && res.error) throw new Error(res.error)
  return res
}
