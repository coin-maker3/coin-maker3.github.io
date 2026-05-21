/**
 * Hash-based routing so deep links work on static hosts (GitHub Pages).
 * Routes:
 *   #/             → clinician page (default)
 *   #/clinician    → clinician page
 *   #/patient      → patient form
 *   #/patient?ref= → patient form pre-filled with a reference
 */
import { useEffect, useState } from 'react'

export type Route =
  | { name: 'clinician' }
  | { name: 'patient'; ref: string | null }

const parseHash = (): Route => {
  const hash = window.location.hash.replace(/^#/, '')
  if (hash.startsWith('/patient')) {
    const q = hash.split('?')[1] ?? ''
    const params = new URLSearchParams(q)
    return { name: 'patient', ref: params.get('ref') }
  }
  return { name: 'clinician' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash)
  useEffect(() => {
    const handler = () => setRoute(parseHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  return route
}

export const linkTo = {
  clinician: () => '#/clinician',
  patient: (ref?: string) => `#/patient${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`,
}
