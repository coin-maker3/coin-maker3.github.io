import { ClinicianPage } from './pages/ClinicianPage'
import { PatientPage } from './pages/PatientPage'
import { AuditPage } from './pages/AuditPage'
import { AuditNewPage } from './pages/AuditNewPage'
import { useRoute } from './lib/router'

function App() {
  const route = useRoute()
  if (route.name === 'patient') return <PatientPage initialRef={route.ref} />
  if (route.name === 'audit') return <AuditPage />
  if (route.name === 'audit-new') return <AuditNewPage />
  return <ClinicianPage />
}

export default App
