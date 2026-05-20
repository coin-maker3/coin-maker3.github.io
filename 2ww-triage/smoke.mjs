/**
 * Smoke test for the deployed 2WW Triage Aid.
 *
 * Runs against the production build served locally. The same dist/ files are
 * what's published at https://coin-maker3.github.io/triage/, so a pass here
 * means a pass on the live URL.
 */
import { chromium } from 'playwright'

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173/triage/'

const results = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})
const page = await context.newPage()

// Capture console errors
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})

// 1) Page loads
const resp = await page.goto(BASE, { waitUntil: 'networkidle' })
record('Page returns 200', resp?.status() === 200, `status=${resp?.status()}`)

// 2) Title is correct
const title = await page.title()
record('Title set correctly', /2WW Colorectal/i.test(title), `title="${title}"`)

// 3) App heading renders (proves React mounted)
const heading = await page.getByText('2WW Colorectal Triage Aid').first().textContent()
record('App heading visible', !!heading, heading)

// 4) Form fields present
const fitInput = page.locator('#fit')
record('FIT field present', (await fitInput.count()) === 1)
const ageBand = page.locator('#ageBand')
record('Age band selector present', (await ageBand.count()) === 1)

// 5) Initial decision card shows the placeholder
const noFitText = await page
  .getByText(/Recommended investigation|Discuss with Consultant/i)
  .first()
  .isVisible()
record('Decision card renders on load', noFitText)

// 6) Algorithm version stamped
const versionBadge = await page.getByText(/GEH-2WW-COLORECTAL/).first().isVisible()
record('Algorithm version visible', versionBadge)

// --- 7) Simulated case: FIT positive should route to colonoscopy
await fitInput.fill('45')
await page.waitForTimeout(300)
const decisionTitle = await page
  .locator('h3:has-text("Colonoscopy"), h3:has-text("CT")')
  .first()
  .textContent()
record(
  'FIT=45 routes to Colonoscopy (placeholder rule)',
  /colonoscopy/i.test(decisionTitle ?? ''),
  decisionTitle ?? '',
)

// --- 8) Simulated case: FIT below threshold should route to discharge
await fitInput.fill('5')
await page.waitForTimeout(300)
const dischargeTitle = await page
  .locator('h3:has-text("Discharge")')
  .first()
  .textContent()
record(
  'FIT=5 routes to Discharge (placeholder rule)',
  /discharge/i.test(dischargeTitle ?? ''),
  dischargeTitle ?? '',
)

// --- 9) Letter generator produces text
const letterBox = page.locator('textarea[readonly]')
const letter = await letterBox.inputValue()
record(
  'Letter draft includes placeholders',
  letter.includes('[Patient Name]') && letter.includes('[NHS No]'),
  `${letter.length} chars`,
)

// --- 10) Algorithm path expandable
await page.getByText(/Show algorithm path/i).click()
await page.waitForTimeout(200)
const pathStep = await page.getByText(/PLACEHOLDER\.FIT_NEG|PLACEHOLDER\.FIT_POS/).first().isVisible()
record('Algorithm path viewer expands', pathStep)

// --- 11) Console clean
record(
  'No console errors',
  consoleErrors.length === 0,
  consoleErrors.slice(0, 3).join(' | '),
)

await page.screenshot({ path: '/tmp/smoke-final.png', fullPage: true })
await browser.close()

const passes = results.filter((r) => r.ok).length
const fails = results.length - passes
console.log(`\n${passes}/${results.length} passed, ${fails} failed`)
process.exit(fails === 0 ? 0 : 1)
