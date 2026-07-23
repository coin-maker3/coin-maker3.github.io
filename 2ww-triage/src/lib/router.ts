import { useEffect, useState } from 'react'

export type Route =
  | { name: 'clinician' }
  | { name: 'patient'; ref: string | null }
  | { name: 'audit' }
  | { name: 'audit-new' }

const parseHash = (): Route => {
  const hash = window.location.hash.replace(/^#/, '')
  if (hash.startsWith('/patient')) {
    const q = hash.split('?')[1] ?? ''
    const params = new URLSearchParams(q)
    return { name: 'patient', ref: params.get('ref') }
  }
  if (hash === '/audit/new' || hash.startsWith('/audit/new?')) return { name: 'audit-new' }
  if (hash === '/audit' || hash.startsWith('/audit?')) return { name: 'audit' }
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
  audit: () => '#/audit',
  auditNew: () => '#/audit/new',
}
