import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Path-to-hash rescue: someone typing /audit instead of /#/audit hits
// Vercel's SPA rewrite, lands on / with the pathname preserved. Convert
// that to the hash route before the SPA's router reads location.
;(() => {
  const path = window.location.pathname
  if (path && path !== '/' && !path.startsWith('/api/')) {
    const target = `/#${path}${window.location.search}`
    window.history.replaceState(null, '', target)
  }
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
