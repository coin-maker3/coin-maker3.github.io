import { chromium } from 'playwright'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})
const page = await browser
  .newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
  .then((c) => c.newPage())
await page.goto('http://localhost:4173/triage/', { waitUntil: 'networkidle' })

await page.selectOption('#clinicType', 'face_to_face')
await page.selectOption('#ageBand', '60-69')
await page.selectOption('#sex', 'F')
await page.fill('#who', '1')
await page.check('text=Change in bowel habit')
// flip CIBH symptom Yes
const cibhSymRow = page.locator('text=Change in bowel habit').nth(1).locator('..')
await cibhSymRow.getByRole('button', { name: 'Yes' }).click()
await page.fill('#hb', '95')
await page.fill('#mcv', '70')
await page.fill('#ferritin', '8')
await page.fill('#fit', '180')

await page.waitForTimeout(500)
await page.getByText(/Show algorithm path/i).click()
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/shot-ida.png', fullPage: true })
await browser.close()
console.log('done')
