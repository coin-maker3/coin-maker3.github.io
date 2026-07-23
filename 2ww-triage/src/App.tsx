import { ClinicianPage } from './pages/ClinicianPage'
import { PatientPage } from './pages/PatientPage'
import { AuditPage } from './pages/AuditPage'
import { AuditNewPage } from './pages/AuditNewPage'
import { useRoute } from './lib/router'

function PilotBanner() {
  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm">
      <strong>Pilot — audit use only.</strong> Not a Trust-endorsed clinical
      decision support tool. Do not use to triage real patients. No patient
      identifiable data must be entered.
    </div>
  )
}

function App() {
  const route = useRoute()
  let page
  if (route.name === 'patient') page = <PatientPage initialRef={route.ref} />
  else if (route.name === 'audit') page = <AuditPage />
  else if (route.name === 'audit-new') page = <AuditNewPage />
  else page = <ClinicianPage />
  return (
    <>
      <PilotBanner />
      {page}
    </>
  )
}

export default App
