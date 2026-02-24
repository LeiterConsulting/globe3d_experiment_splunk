import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '../App'
import '../styles.css'

function mount() {
  const el = document.getElementById('splunk-globe-app-root')
  if (!el) return

  ReactDOM.createRoot(el).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

mount()
