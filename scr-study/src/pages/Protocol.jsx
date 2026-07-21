const beats = [
  {
    n: 1,
    title: 'Headline',
    accent: false,
    body: 'Direct answer plus your top concern, in one line. Say the most important thing first — the examiner should know within ten seconds that you have grasped the case.',
    example: '"My immediate concern here is a spreading infection with airway risk, so today is about safe urgent management and referral."',
  },
  {
    n: 2,
    title: 'Domain 1 sweep — information gathering & diagnosis',
    accent: false,
    body: 'History, examination, investigations — and after each one say **because**. Give a differential, then commit to a working diagnosis. Justify every special test (IRMER: every radiograph needs a stated justification).',
    example: '"I would take a full pain history because the character and timing distinguish reversible from irreversible pulpitis…"',
  },
  {
    n: 3,
    title: 'Domain 2 — today’s safe management',
    accent: false,
    body: 'What you would do **today** to make the patient safe: immediate management, red flags you are actively excluding, urgency, and the refer-or-treat decision with your threshold stated out loud.',
    example: '"Today my priority is drainage and pain control; the red flags that would change this to an emergency referral are trismus, dysphagia or systemic involvement."',
  },
  {
    n: 4,
    title: 'Domain 3 — planning & execution',
    accent: false,
    body: 'Stabilise → definitive → maintenance. Present the realistic options **including doing nothing**, with risks and benefits of each, and how you would sequence and review the plan.',
    example: '"Once stable, the options are root canal treatment, extraction, or no treatment — and I would explain the risks and benefits of each, including leaving it alone."',
  },
  {
    n: 5,
    title: 'Domain 4 close — never skipped',
    accent: true,
    body: 'Finish **every** answer with: consent (material risks, Montgomery), documentation (contemporaneous, what was discussed and declined), safety-netting (what to look out for and when to come back), and your referral threshold.',
    example: '"I would document the discussion including the risks the patient declined, safety-net with specific instructions to return if the swelling spreads or they feel unwell, and refer if there is no improvement in 48 hours."',
  },
]

const multipliers = [
  'Say "because" after every action — an action without a reason scores nothing.',
  'Name a source: SDCEP, NICE, GDC Standards, IRMER 2017, BNF, FGDP/CGDent.',
  'Safety-net out loud, with specifics — what to watch for, and when and where to return.',
  '"Beyond this point I would seek senior advice / refer" scores UP, not down. Knowing your limits is a competency.',
]

export default function Protocol() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">The five-beat answer</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every SCR answer follows the same shape. Practise until it is automatic.
        </p>
      </div>

      <div className="space-y-3">
        {beats.map((b) => (
          <section
            key={b.n}
            className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${
              b.accent ? 'border-l-4 border-violet-400 ring-violet-200' : 'ring-slate-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                  b.accent ? 'bg-violet-600' : 'bg-teal-700'
                }`}
              >
                {b.n}
              </span>
              <div>
                <h2 className="font-semibold leading-snug">{b.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {renderBold(b.body)}
                </p>
                <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-sm italic text-slate-500">
                  {b.example}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-2xl bg-teal-50 p-4 ring-1 ring-teal-100">
        <h2 className="text-sm font-semibold text-teal-900">Score multipliers</h2>
        <ul className="mt-2 space-y-2">
          {multipliers.map((m, i) => (
            <li key={i} className="flex gap-2 text-sm text-teal-900">
              <span className="shrink-0 font-bold text-teal-600">×</span>
              <span>{m}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// Tiny helper: renders **bold** spans in the beat body text.
function renderBold(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))
}
