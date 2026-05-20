# 2WW Colorectal Triage Aid (George Eliot Hospital)

Local, browser-only clinical decision support for 2-week-wait colorectal
clinic. Encodes the Trust 2WW investigation algorithm as a versioned
decision tree, fills the clinic-form wording, and shows the full algorithm
path traversed for audit and teaching.

## Constraints

- **No PID.** No patient name, DOB, NHS number, or any identifier is ever
  entered, stored, or transmitted. The form uses age band only.
- **No network calls.** No backend, no database, no API. Runs entirely in
  the browser on your laptop.
- **No persistence.** State lives only in React. Refreshing the page wipes
  every input. Nothing is written to localStorage.

The clinic letter output uses literal placeholder strings
(`[Patient Name]`, `[DOB]`, `[NHS No]`, `[GP Name]`) — paste the output
into the Trust Word template and add demographics from the hospital
system there.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS 3 with NHS colour palette
- Zod for input schema
- Vitest + Testing Library for tests
- Pure-functional decision engine in `src/algorithm/`

## Running

```bash
npm install
npm run dev        # http://localhost:5173
npm run test:run   # run the test suite once
npm run test       # watch mode
npm run build      # production build to dist/
```

## Project layout

```
src/
  algorithm/
    version.ts        Algorithm version metadata (stamped on every decision)
    types.ts          Investigation enum, DecisionResult, PathStep types
    engine.ts         Pure-functional decision tree (placeholder rules)
    engine.test.ts    Unit tests per algorithm branch
  schema/
    intake.ts         Zod schema and TypeScript types for the form
  components/
    IntakeForm.tsx    Form (matches Trust 2WW clinic form fields)
    DecisionCard.tsx
    PathViewer.tsx    Expandable list of every branch traversed
    LetterPanel.tsx   Clinic letter draft + copy-to-clipboard
    YesNo.tsx
  letter/
    template.ts       Builds letter matching the Trust Word template
  App.tsx
  main.tsx
```

## Algorithm versioning

Every `DecisionResult` carries:

- `algorithm.id` and `algorithm.version`
- `algorithmNodeId` — traceable to the Trust PDF (e.g. `IDA.2a`)
- `path` — every branch traversed from root to leaf
- `computedAt` ISO timestamp

This is the audit trail. When the Trust algorithm changes, bump
`src/algorithm/version.ts` and add a new branch in `engine.ts` with a
fresh node ID. Old decisions remain reproducible.

## NHS governance

This is a Class I clinical decision support tool (informs, does not
decide). Before deployment in clinical use:

- Engage the Trust **Clinical Safety Officer** for DCB0160 sign-off
- Confirm the algorithm matches the **current MDT-approved guidance**
- Audit the test suite covers every branch
- Treat the version stamp as the authoritative record of which rules
  were applied to a given decision

## Status

**v0.1.0-placeholder** — UI complete, decision engine running on a single
placeholder rule (`FIT >= 10 -> colonoscopy`). Real Trust algorithm to be
encoded next.
