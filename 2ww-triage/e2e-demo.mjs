/**
 * Full end-to-end demo: clinician issues ref → patient fills form on their
 * "phone" → clinician imports → algorithm runs → letter generated.
 *
 * Runs against the local Vite dev server (which serves the in-memory API).
 */
import { chromium, devices } from 'playwright'

const URL = process.env.DEMO_URL ?? 'http://localhost:5173/'
const SHOT = (name) => `/tmp/demo-${name}.png`

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})

// ---------- 1) Clinician device ----------
const clinicianCtx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
})
const clinician = await clinicianCtx.newPage()
await clinician.goto(URL, { waitUntil: 'networkidle' })
await clinician.screenshot({ path: SHOT('1-clinician-start'), fullPage: true })

// Click "Generate reference"
await clinician.getByRole('button', { name: 'Generate reference' }).click()
await clinician.waitForTimeout(300)

// Capture the generated ref
const refText = await clinician.locator('code').filter({ hasText: /^TEST-/ }).first().textContent()
const ref = refText?.trim() ?? ''
console.log('Generated ref:', ref)

const patientUrl = (await clinician
  .locator('div.break-all')
  .first()
  .textContent())?.trim()
console.log('Patient URL:', patientUrl)
await clinician.screenshot({ path: SHOT('2-clinician-ref-issued'), fullPage: false })

// ---------- 2) Patient device (mobile) ----------
const patientCtx = await browser.newContext({
  ...devices['iPhone 14 Pro'],
  deviceScaleFactor: 2,
})
const patient = await patientCtx.newPage()
await patient.goto(patientUrl, { waitUntil: 'networkidle' })
await patient.screenshot({ path: SHOT('3-patient-open'), fullPage: true })

// Patient: 70-79 F, with bowel habit change + bright red bleeding + weight loss + family hx
await patient.selectOption('#ageBand', '70-79')
await patient.selectOption('#sex', 'F')

const yesOn = async (id) => {
  await patient
    .locator(`[aria-labelledby="${id}-label"]`)
    .getByRole('button', { name: 'Yes' })
    .click()
}

await yesOn('cibh')
await patient.fill('#cibhWeeks', '8')
await patient.selectOption('#bleed', 'bright')
await yesOn('mucus')
await yesOn('tenes')
await yesOn('weight')
await patient.fill('#weightKg', '4')
await yesOn('fhx')
await yesOn('indADL')
await yesOn('overnight')
await yesOn('prep')

await patient.screenshot({ path: SHOT('4-patient-filled'), fullPage: true })

// Submit
await patient.getByRole('button', { name: /Send my answers/i }).click()
await patient.waitForTimeout(500)
await patient.screenshot({ path: SHOT('5-patient-thanks'), fullPage: true })

// ---------- 3) Back to clinician — import ----------
await clinician.bringToFront()
await clinician.getByRole('button', { name: 'Import…' }).click()
await clinician.fill('#patient-ref', ref)
await clinician.getByRole('button', { name: 'Look up' }).click()
await clinician.waitForTimeout(600)
await clinician.screenshot({ path: SHOT('6-clinician-imported'), fullPage: true })

// ---------- 4) Clinician adds bloods (IDA on this case) ----------
await clinician.fill('#hb', '95')
await clinician.fill('#mcv', '72')
await clinician.fill('#ferritin', '8')
await clinician.fill('#fit', '180')
await clinician.waitForTimeout(400)
await clinician.screenshot({ path: SHOT('7-clinician-with-bloods'), fullPage: true })

// Expand algorithm path
await clinician.getByText(/Show algorithm path/i).click()
await clinician.waitForTimeout(300)
await clinician.screenshot({ path: SHOT('8-clinician-decision-path'), fullPage: true })

// Verify decision
const decision = await clinician.locator('h3').first().textContent()
console.log('\n→ Final decision:', decision?.trim())

await browser.close()
console.log('done')
