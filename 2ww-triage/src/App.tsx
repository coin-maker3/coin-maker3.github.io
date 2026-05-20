import { useMemo, useState } from 'react'
import { IntakeForm } from './components/IntakeForm'
import { DecisionCard } from './components/DecisionCard'
import { LetterPanel } from './components/LetterPanel'
import { PathViewer } from './components/PathViewer'
import { decide } from './algorithm/engine'
import { ALGORITHM_VERSION } from './algorithm/version'
import { DEFAULT_INTAKE, type Intake } from './schema/intake'

function App() {
  const [intake, setIntake] = useState<Intake>(DEFAULT_INTAKE)
  const decision = useMemo(() => decide(intake), [intake])

  const reset = () => setIntake(DEFAULT_INTAKE)

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-nhs-dark-blue">
              2WW Colorectal Triage Aid
            </h1>
            <p className="text-xs text-nhs-mid-grey">
              George Eliot Hospital · local clinical-decision support · no PID, no transmission
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-nhs-mid-grey">
            <span>
              Algorithm{' '}
              <code className="rounded bg-nhs-pale-grey px-1.5 py-0.5">
                {ALGORITHM_VERSION.id} v{ALGORITHM_VERSION.version}
              </code>
            </span>
            <button type="button" className="btn-secondary" onClick={reset}>
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_460px]">
          <div>
            <IntakeForm value={intake} onChange={setIntake} />
          </div>
          <aside className="space-y-6 lg:sticky lg:top-4 lg:h-fit">
            <DecisionCard decision={decision} />
            <PathViewer decision={decision} />
            <LetterPanel intake={intake} decision={decision} />
          </aside>
        </div>

        <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-nhs-mid-grey">
          <p>
            Decision support only. Clinical judgement always overrides. This tool stores nothing
            between sessions — refreshing the page clears all inputs.
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
