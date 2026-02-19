import { llmProfilesProxyChat, llmProfilesProxyTest, type LlmMessage } from './llmProfilesProxyClient'

function looksLikeProxyNotInstalledError(message: string) {
  const m = (message || '').toLowerCase()
  return m.includes('404') && (m.includes('llm_profiles_proxy') || m.includes('/llm_profiles_proxy') || m.includes('profiles proxy'))
}

export type LlmSdkTargeting = {
  /** Splunk app id making the request (required for governed routing) */
  app: string
  /** Optional explicit profile override (bypasses app mapping requirement) */
  profile_id?: string
}

export async function llmSdkTest(prompt: string, targeting: LlmSdkTargeting) {
  try {
    return await llmProfilesProxyTest(prompt, targeting)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (looksLikeProxyNotInstalledError(msg)) {
      throw new Error('Please install and configure the Splunk LLM Proxy app for LLM-enhanced functions.')
    }
    throw e
  }
}

export async function llmSdkChat(messages: LlmMessage[], targeting: LlmSdkTargeting) {
  try {
    return await llmProfilesProxyChat(messages, targeting)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (looksLikeProxyNotInstalledError(msg)) {
      throw new Error('Please install and configure the Splunk LLM Proxy app for LLM-enhanced functions.')
    }
    throw e
  }
}

export type { LlmMessage }
