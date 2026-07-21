# SCR Study

A material-first study app for the **LDS Part 2 Structured Clinical Reasoning (SCR)** dental exam. It is a reader for pre-written worked cases — no backend, no auth, no AI. All content is static JSON; progress lives in the browser's localStorage.

## Run it

```bash
cd scr-study
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`). That's it — there is no configuration.

Build for production:

```bash
npm run build     # outputs to dist/
npm run preview   # serve the production build locally
```

## How to use it (drill mode)

1. Open a case. Read the stem.
2. For each domain, **say your answer out loud first**, then tap *Reveal* and compare against the model answer. Domain 4 is accented — it's the exam's weak-spot domain; never skip it.
3. After all four domains: review *Where marks are lost*, work the probes (tap a question to reveal its answer), and check the references.
4. Self-score: how many domains did you cover **unprompted** (0–4)? Saving a score marks the case done and feeds the Stats page.

## Adding content — zero code changes

Content auto-indexes via `import.meta.glob`. Drop a valid JSON file into the right folder and it appears in the app on the next dev-server refresh / build:

- **Cases** → `src/content/cases/<anything>.json`
- **Sheets** → `src/content/sheets/<anything>.json`

### Case schema

```json
{
  "id": "m3-002",
  "title": "Short descriptive title",
  "module": "M1|M2|M3|M4|M5|M6|M7|M8|E",
  "difficulty": "Straightforward|Moderate|Complex",
  "spf_codes": ["P1.1", "P(B)1", "C2.8.7"],
  "stem": "markdown string",
  "domains": [
    { "n": 1, "name": "Information gathering, assimilation & diagnosis", "model_answer": "markdown", "spf_codes": ["C1.10"] },
    { "n": 2, "name": "Management of scenario", "model_answer": "markdown" },
    { "n": 3, "name": "Management planning & execution", "model_answer": "markdown" },
    { "n": 4, "name": "Professionalism, ethics & medicolegal", "model_answer": "markdown" }
  ],
  "marks_lost": ["bullet", "bullet"],
  "probes": [{ "q": "question", "a": "answer" }],
  "references": ["SDCEP Drug Prescribing", "GDC Standards"]
}
```

Notes:

- `id` must be unique — it keys the localStorage progress, so don't rename an id after scoring attempts against it.
- Cases are grouped and ordered by module (order defined in `src/content/modules.json`), then by `id` within a module — so `m3-001`, `m3-002`, … sort naturally.
- `stem` and each `model_answer` are markdown (rendered with react-markdown). Escape newlines as `\n` inside the JSON string.
- Any drug dose in content should be followed by `[verify against current BNF/SDCEP]`.
- `spf_codes` (case level, required) lists the SPF codes the case exercises; each domain object may add its own optional `spf_codes` array. Codes render as tappable chips (decoded from `spf.json`) and become the "demonstrated out loud?" checklist in the self-score widget.

### Sheet schema

```json
{ "id": "consent", "title": "Consent, capacity & Montgomery", "body": "markdown" }
```

### SPF decode table

`src/content/spf.json` is a single array — the source for the chips, the Codes page, and the per-code coverage stats:

```json
[
  {
    "code": "P1.1",
    "domain": "Professionalism",
    "outcome": "official outcome text",
    "say_it": "one line of what demonstrating this out loud sounds like in an answer"
  }
]
```

The seeded entries are placeholders (marked `[placeholder]`) — replace them with the official text. A code used in a case but missing from `spf.json` still renders; its decode sheet just says the entry is missing.

## Deploy to Firebase Hosting

`firebase.json` is already included (public dir `dist`, SPA rewrite).

One-time setup:

```bash
npm install -g firebase-tools
firebase login
firebase projects:create scr-study   # or use an existing project in the Firebase console
```

Create a `.firebaserc` in this folder pointing at your project (or run `firebase use --add`):

```json
{ "projects": { "default": "scr-study" } }
```

Every deploy after that:

```bash
npm run build
firebase deploy --only hosting
```

The app uses hash-based routing and a relative base path, so it also works from any static host or subdirectory (e.g. GitHub Pages) with no extra configuration.

## Where things live

```
src/
  content/
    modules.json      # module codes + labels (defines grouping order)
    cases/*.json      # one worked case per file (auto-indexed)
    sheets/*.json     # one knowledge sheet per file (auto-indexed)
  lib/
    content.js        # import.meta.glob indexing + lookups
    progress.js       # localStorage progress (attempts, last case)
  components/         # Layout (bottom nav), Markdown, badges
  pages/              # Home, Cases, CaseView (drill mode), Sheets, SheetView, Protocol, Stats
```

Progress is stored under the localStorage key `scr-study-progress-v1` on the device/browser it was made on. Clearing site data clears progress.
