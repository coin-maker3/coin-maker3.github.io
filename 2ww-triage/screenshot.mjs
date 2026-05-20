import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})
const page = await context.newPage()
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })

await page.screenshot({ path: '/tmp/shot-initial.png', fullPage: false })

await page.selectOption('#clinicType', 'face_to_face')
await page.selectOption('#ageBand', '70-79')
await page.selectOption('#sex', 'F')
await page.fill('#who', '1')
await page.getByLabel('Rectal bleeding').check()
await page.getByLabel('Change in bowel habit').check()
await page.fill('#hb', '95')
await page.fill('#mcv', '72')
await page.fill('#ferritin', '8')
await page.fill('#fit', '180')

await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/shot-filled-top.png', fullPage: false })
await page.screenshot({ path: '/tmp/shot-filled-full.png', fullPage: true })

await browser.close()
console.log('done')
