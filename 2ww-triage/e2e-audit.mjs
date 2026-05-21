import { chromium } from 'playwright'

const URL = 'http://localhost:5173/'
const SHOT = (n) => `/tmp/audit-${n}.png`

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()

async function enterCase({ initials, month, ageBand, sex, setup, actual, notes }) {
  await page.goto(URL + '#/audit/new')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('#enteredBy', { timeout: 15000 })
  await page.fill('#enteredBy', initials)
  await page.fill('#clinicMonth', month)
  await page.selectOption('#ageBand', ageBand)
  await page.selectOption('#sex', sex)
  await setup(page)
  await page.waitForTimeout(400)
  await page.selectOption('#actualDecision', actual)
  if (notes?.actual) await page.fill('#actualNotes', notes.actual)
  if (notes?.reviewer) {
    const reviewerField = await page.locator('#reviewerNotes').count()
    if (reviewerField > 0) await page.fill('#reviewerNotes', notes.reviewer)
  }
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /Save audit case/i }).click()
  await page.waitForSelector('text=Saved', { timeout: 10000 })
}

// ===== Empty dashboard =====
await page.goto(URL + '#/audit', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: SHOT('1-dashboard-empty'), fullPage: true })

// ===== Case 1: IDA + CIBH → Col + OGD (match) =====
await enterCase({
  initials: 'AB',
  month: '2026-04',
  ageBand: '60-69',
  sex: 'F',
  setup: async (p) => {
    await p.selectOption('#clinicType', 'face_to_face')
    await p.getByLabel('Change in bowel habit').check()
    const cibhRow = p.locator('text=Change in bowel habit').nth(1).locator('..')
    await cibhRow.getByRole('button', { name: 'Yes' }).click()
    await p.fill('#hb', '95')
    await p.fill('#mcv', '70')
    await p.fill('#ferritin', '8')
    await p.fill('#fit', '180')
  },
  actual: 'colonoscopy_plus_ogd',
})

// ===== Case 2: CIBH + FIT+ young → tool Col, clinician did CTVC (mismatch) =====
await enterCase({
  initials: 'AB',
  month: '2026-04',
  ageBand: '50-59',
  sex: 'M',
  setup: async (p) => {
    await p.getByLabel('Change in bowel habit').check()
    const cibhRow = p.locator('text=Change in bowel habit').nth(1).locator('..')
    await cibhRow.getByRole('button', { name: 'Yes' }).click()
    await p.fill('#fit', '45')
  },
  actual: 'ctc',
  notes: {
    actual: 'Patient declined colonoscopy after counselling',
    reviewer: 'Legitimate clinician override for patient preference',
  },
})

// ===== Case 3: Asymptomatic FIT 20 → Colon capsule (match) =====
await enterCase({
  initials: 'CD',
  month: '2026-04',
  ageBand: '50-59',
  sex: 'F',
  setup: async (p) => {
    await p.getByLabel('Asymptomatic FIT positive').check()
    await p.fill('#fit', '20')
  },
  actual: 'colon_capsule',
})

// ===== Case 4: IDA in 85yo → CTVC+OGD (match) =====
await enterCase({
  initials: 'CD',
  month: '2026-04',
  ageBand: '80-89',
  sex: 'F',
  setup: async (p) => {
    await p.getByLabel('Iron deficiency anaemia').check()
    await p.fill('#hb', '100')
    await p.fill('#ferritin', '12')
  },
  actual: 'ctc_plus_ogd',
})

// ===== Case 5: CIBH FIT-VE no risk → Colon capsule, but clinician did CTVC (mismatch) =====
await enterCase({
  initials: 'AB',
  month: '2026-04',
  ageBand: '60-69',
  sex: 'M',
  setup: async (p) => {
    await p.getByLabel('Change in bowel habit').check()
    const cibhRow = p.locator('text=Change in bowel habit').nth(1).locator('..')
    await cibhRow.getByRole('button', { name: 'Yes' }).click()
    await p.fill('#fit', '5')
  },
  actual: 'ctc',
  notes: { reviewer: 'Clinician concerned about polyps despite FIT-VE — pragmatic decision' },
})

// ===== Dashboard now populated =====
await page.goto(URL + '#/audit', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: SHOT('2-dashboard-populated'), fullPage: true })

// Show mismatch filter
await page.selectOption('select', 'mismatch')
await page.waitForTimeout(500)
await page.screenshot({ path: SHOT('3-mismatches-only'), fullPage: true })

// Show entry form on its own
await page.goto(URL + '#/audit/new')
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: SHOT('4-blank-entry-form'), fullPage: true })

await browser.close()
console.log('done')
