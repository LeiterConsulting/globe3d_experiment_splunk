import { useEffect, useMemo, useState } from 'react'
import {
  connectHost,
  getCapability,
  getKnownEndpoints,
  probeHost,
  type ConnectResult,
  type Endpoint,
  type EndpointProbe,
} from './terminalClient'

type Status = 'idle' | 'loading' | 'saving' | 'error'

function renderProbeBadge(ok: boolean, detail: string) {
  return (
    <span
      style={{
        display: 'inline-block',
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 12,
        border: `1px solid ${ok ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
        background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
        color: ok ? '#bbf7d0' : '#fecaca',
      }}
      title={detail}
    >
      {ok ? 'ok' : 'fail'}
    </span>
  )
}

export default function App() {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')

  const [hasAccess, setHasAccess] = useState(false)
  const [requiredCapability, setRequiredCapability] = useState('terminal_remote_access')
  const [user, setUser] = useState('')
  const [capabilities, setCapabilities] = useState<string[]>([])

  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [probeMap, setProbeMap] = useState<Record<string, EndpointProbe>>({})
  const [connectionResult, setConnectionResult] = useState<ConnectResult | null>(null)

  const [customHost, setCustomHost] = useState('')
  const [customPort, setCustomPort] = useState('22')

  const probeCount = useMemo(() => Object.keys(probeMap).length, [probeMap])

  async function refreshAll(withProbe: boolean) {
    setStatus('loading')
    setError('')
    setConnectionResult(null)
    try {
      const [capRes, endpointRes] = await Promise.all([getCapability(), getKnownEndpoints(withProbe)])
      setHasAccess(capRes.has_access)
      setRequiredCapability(capRes.required_capability)
      setUser(capRes.user)
      setCapabilities(capRes.capabilities || [])

      setEndpoints(endpointRes.endpoints || [])
      const nextMap: Record<string, EndpointProbe> = {}
      for (const item of endpointRes.probes || []) {
        nextMap[item.endpoint_id] = item
      }
      setProbeMap(nextMap)
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void refreshAll(true)
  }, [])

  async function handleProbeEndpoint(ep: Endpoint) {
    setStatus('saving')
    setError('')
    try {
      const probe = await probeHost(ep.host, ep.port)
      setProbeMap((prev) => ({ ...prev, [ep.id]: probe }))
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleConnect(ep: Endpoint) {
    setStatus('saving')
    setError('')
    setConnectionResult(null)
    try {
      const res = await connectHost(ep.host, ep.port)
      setConnectionResult(res)
      if (res.connection?.launch?.url) {
        window.open(res.connection.launch.url, '_blank', 'noopener,noreferrer')
      }
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleProbeCustom() {
    const host = customHost.trim()
    const port = Number.parseInt(customPort.trim(), 10)
    if (!host) {
      setStatus('error')
      setError('Set a custom host before probing.')
      return
    }
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      setStatus('error')
      setError('Custom port must be between 1 and 65535.')
      return
    }

    setStatus('saving')
    setError('')
    try {
      const probe = await probeHost(host, port)
      setProbeMap((prev) => ({ ...prev, custom: { ...probe, endpoint_id: 'custom' } }))
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleConnectCustom() {
    const host = customHost.trim()
    const port = Number.parseInt(customPort.trim(), 10)
    if (!host) {
      setStatus('error')
      setError('Set a custom host before connecting.')
      return
    }
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      setStatus('error')
      setError('Custom port must be between 1 and 65535.')
      return
    }

    setStatus('saving')
    setError('')
    try {
      const res = await connectHost(host, port)
      setConnectionResult(res)
      if (res.connection?.launch?.url) {
        window.open(res.connection.launch.url, '_blank', 'noopener,noreferrer')
      }
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: 20 }}>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Splunk Terminal App</div>
        <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 13 }}>
          Probes known endpoints for SSH/remote-terminal capability and allows direct connect only when the current user has the required Splunk capability.
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
          <div style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 10 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>User</div>
            <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{user || '(unknown)'}</div>
          </div>
          <div style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 10 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Required capability</div>
            <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{requiredCapability}</div>
          </div>
          <div style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 10 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Access result</div>
            <div style={{ color: hasAccess ? '#86efac' : '#fca5a5', fontWeight: 700 }}>{hasAccess ? 'allowed' : 'denied'}</div>
          </div>
          <div style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 10 }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Known endpoints / probe records</div>
            <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{endpoints.length} / {probeCount}</div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => void refreshAll(false)} disabled={status === 'loading'} style={{ cursor: 'pointer' }}>
            Refresh list
          </button>
          <button onClick={() => void refreshAll(true)} disabled={status === 'loading'} style={{ cursor: 'pointer' }}>
            Probe all
          </button>
        </div>
      </div>

      {!hasAccess ? (
        <div style={{ marginTop: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 14, padding: 12, color: '#fde68a' }}>
          Current user is missing capability <code>{requiredCapability}</code>. Add this capability to a Splunk role, then re-login.
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14, padding: 12, color: '#fee2e2', whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 16 }}>
        <div style={{ fontWeight: 700 }}>Known endpoints</div>

        {endpoints.length ? (
          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
            {endpoints.map((ep) => {
              const probe = probeMap[ep.id]
              return (
                <div key={ep.id} style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{ep.id}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>{ep.host}:{ep.port} {ep.description ? `• ${ep.description}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => void handleProbeEndpoint(ep)} disabled={status === 'saving'} style={{ cursor: 'pointer' }}>
                        Probe
                      </button>
                      <button onClick={() => void handleConnect(ep)} disabled={status === 'saving' || !hasAccess} style={{ cursor: hasAccess ? 'pointer' : 'not-allowed' }}>
                        Connect
                      </button>
                    </div>
                  </div>

                  {probe ? (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {renderProbeBadge(probe.probes.dns.ok, probe.probes.dns.detail)}
                      {renderProbeBadge(probe.probes.tcp.ok, probe.probes.tcp.detail)}
                      {renderProbeBadge(probe.probes.ssh_banner.ok, probe.probes.ssh_banner.detail)}
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>No probe data yet.</div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 13 }}>No enabled endpoints found in <code>terminal_assets.conf</code>.</div>
        )}
      </div>

      <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 16 }}>
        <div style={{ fontWeight: 700 }}>Custom target</div>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 160px auto auto', gap: 8 }}>
          <input value={customHost} onChange={(e) => setCustomHost(e.target.value)} placeholder="host or IP" style={{ background: '#020617', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px' }} />
          <input value={customPort} onChange={(e) => setCustomPort(e.target.value)} placeholder="22" style={{ background: '#020617', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px' }} />
          <button onClick={() => void handleProbeCustom()} disabled={status === 'saving'} style={{ cursor: 'pointer' }}>
            Probe custom
          </button>
          <button onClick={() => void handleConnectCustom()} disabled={status === 'saving' || !hasAccess} style={{ cursor: hasAccess ? 'pointer' : 'not-allowed' }}>
            Connect custom
          </button>
        </div>

        {probeMap.custom ? (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {renderProbeBadge(probeMap.custom.probes.dns.ok, probeMap.custom.probes.dns.detail)}
            {renderProbeBadge(probeMap.custom.probes.tcp.ok, probeMap.custom.probes.tcp.detail)}
            {renderProbeBadge(probeMap.custom.probes.ssh_banner.ok, probeMap.custom.probes.ssh_banner.detail)}
          </div>
        ) : null}
      </div>

      {connectionResult ? (
        <div style={{ marginTop: 14, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 16, padding: 16 }}>
          <div style={{ fontWeight: 700 }}>Connection result</div>
          <pre style={{ marginTop: 8, background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(connectionResult, null, 2)}
          </pre>
        </div>
      ) : null}

      {capabilities.length ? (
        <div style={{ marginTop: 14, color: '#94a3b8', fontSize: 12 }}>
          Current capabilities: {capabilities.join(', ')}
        </div>
      ) : null}
    </div>
  )
}
