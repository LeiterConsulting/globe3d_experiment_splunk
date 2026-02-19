import { useEffect, useState } from 'react'
import { getCapability, getKnownEndpoints } from './terminalClient'

type Status = 'loading' | 'idle' | 'error'

export default function App() {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')

  const [user, setUser] = useState('(unknown)')
  const [hasAccess, setHasAccess] = useState(false)
  const [requiredCapability, setRequiredCapability] = useState('terminal_remote_access')
  const [endpointCount, setEndpointCount] = useState(0)

  async function refresh() {
    setStatus('loading')
    setError('')
    try {
      const [capability, endpoints] = await Promise.all([getCapability(), getKnownEndpoints(false)])
      setUser(capability.user || '(unknown)')
      setHasAccess(capability.has_access)
      setRequiredCapability(capability.required_capability || 'terminal_remote_access')
      setEndpointCount((endpoints.endpoints || []).length)
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Minimal Splunk React Starter</h2>
      <p style={{ color: '#94a3b8' }}>
        This minimal variant keeps backend/controller plumbing intact and gives you a lightweight shell to prototype from.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
        <div style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 10 }}>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>User</div>
          <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{user}</div>
        </div>
        <div style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 10 }}>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Access</div>
          <div style={{ color: hasAccess ? '#86efac' : '#fca5a5', fontWeight: 700 }}>{hasAccess ? 'allowed' : 'denied'}</div>
        </div>
        <div style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 10 }}>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Required capability</div>
          <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{requiredCapability}</div>
        </div>
        <div style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 10 }}>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Known endpoints</div>
          <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{endpointCount}</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={() => void refresh()} disabled={status === 'loading'}>
          {status === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {!hasAccess ? (
        <div style={{ marginTop: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 10, color: '#fde68a' }}>
          Current user is missing capability <code>{requiredCapability}</code>.
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: 10, color: '#fee2e2', whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      ) : null}
    </div>
  )
}
