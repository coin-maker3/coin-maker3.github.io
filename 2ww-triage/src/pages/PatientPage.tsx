import { PatientForm } from '../components/PatientForm'

interface Props {
  initialRef: string | null
}

export function PatientPage({ initialRef }: Props) {
  return (
    <div className="min-h-screen bg-nhs-pale-grey">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-3 sm:px-6">
          <p className="text-xs uppercase tracking-wide text-nhs-mid-grey">
            George Eliot Hospital — Colorectal 2WW
          </p>
        </div>
      </header>
      <PatientForm initialRef={initialRef} />
      <footer className="mx-auto max-w-2xl px-4 pb-6 pt-4 text-center text-xs text-nhs-mid-grey">
        If you can't fill this in online, please tell reception when you arrive — they can help.
      </footer>
    </div>
  )
}
