import { ClinicianPage } from './pages/ClinicianPage'
import { PatientPage } from './pages/PatientPage'
import { useRoute } from './lib/router'

function App() {
  const route = useRoute()
  if (route.name === 'patient') {
    return <PatientPage initialRef={route.ref} />
  }
  return <ClinicianPage />
}

export default App
