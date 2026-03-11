import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from '@playwright/test'

type BrowserSagaDefinition = {
  ucId: number
  sagaKey: string
  specFile: string
  persona: string
  ownerBusinessLabel: string
  serviceName: string
  offerName: string
  durationMode: 'fixed' | 'variable'
  defaultDurationMin: number
  priceMinor: number
  criticalChecks: string[]
}

type BrowserSagaManifest = {
  ok: boolean
  ucId: number
  sagaKey: string
  baseUrl: string
  startedAt: string
  finishedAt: string
  owner: { name: string; email: string }
  customer: { name: string; email: string }
  assertions: {
    guestRedirectToLogin: boolean
    customerBlockedFromDevLab: boolean
    ownerDashboardLoaded: boolean
    customerBookingCreated: boolean
    stripeIntentAttempted: boolean
    ownerMessageFeedVisible: boolean
    ownerReportRendered: boolean
  }
  screenshotsDir: string
  screenshots: string[]
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../../../../')
const definitionsPath = path.resolve(rootDir, 'testing/browser-sagas/definitions/uc-1-to-10.browser.json')
const repoRunsDir = path.resolve(rootDir, 'testing/browser-sagas/runs')

const baseUrl = process.env.ADMIN_BASE_URL ?? 'http://localhost:9000'
const holdMs = Number(process.env.HOLD_MS ?? '1500')
const ucId = Number(process.env.UC_ID ?? '1')
const stamp = Date.now().toString(36)
const outDir = path.resolve('/tmp', `browser-saga-uc${ucId}-${stamp}`)

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function shot(page: Page, screenshots: string[], name: string) {
  const fileName = `${name}.png`
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: true })
  screenshots.push(fileName)
}

async function signUp(page: Page, input: { name: string; email: string; password: string }) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  const switchButton = page.getByRole('button', { name: 'Need an account?' })
  if (await switchButton.isVisible().catch(() => false)) {
    await switchButton.click()
  }

  await page.getByPlaceholder('display name').fill(input.name)
  await page.getByPlaceholder('email').fill(input.email)
  await page.getByPlaceholder('password').fill(input.password)
  const createAccountButton = page.getByRole('button', { name: /Create account|Create my business/i })
  await createAccountButton.click()
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }),
    createAccountButton.waitFor({ state: 'visible', timeout: 15000 }),
  ]).catch(() => null)
  await page.waitForLoadState('networkidle')
}

async function selectOption(page: Page, trigger: ReturnType<Page['getByRole']>, optionMatcher?: RegExp) {
  const visible = await trigger.isVisible().catch(() => false)
  if (!visible) return false
  await trigger.click()
  if (optionMatcher) {
    const preferred = page.getByRole('option', { name: optionMatcher }).first()
    if (await preferred.isVisible().catch(() => false)) {
      await preferred.click()
      return true
    }
  }
  const first = page.getByRole('option').first()
  if (await first.isVisible().catch(() => false)) {
    await first.click()
    return true
  }
  return false
}

async function run() {
  const definitionsRaw = await readFile(definitionsPath, 'utf8')
  const definitions = JSON.parse(definitionsRaw) as { sagas: BrowserSagaDefinition[] }
  const definition = definitions.sagas.find((row) => row.ucId === ucId)
  if (!definition) {
    throw new Error(`UC-${ucId} definition not found in ${definitionsPath}`)
  }

  await mkdir(outDir, { recursive: true })
  await mkdir(repoRunsDir, { recursive: true })

  const lettersOnlyStamp = (stamp.replace(/[^a-z]/g, '') || 'alpha').slice(0, 10)
  const ownerSeed = `saga${lettersOnlyStamp}owner`
  const ownerName = ownerSeed
  const customerName = `uc${ucId}${stamp}customer`
  const password = 'Passw0rd!234'
  const ownerEmail = `${ownerSeed}@example.com`
  const customerEmail = `customer.uc${ucId}.${stamp}@example.com`
  const ownerBizName = `${ownerSeed.slice(0, 1).toUpperCase()}${ownerSeed.slice(1).toLowerCase()}'s Studio`

  const screenshots: string[] = []
  const manifest: BrowserSagaManifest = {
    ok: false,
    ucId: definition.ucId,
    sagaKey: definition.sagaKey,
    baseUrl,
    startedAt: new Date().toISOString(),
    finishedAt: '',
    owner: { name: ownerName, email: ownerEmail },
    customer: { name: customerName, email: customerEmail },
    assertions: {
      guestRedirectToLogin: false,
      customerBlockedFromDevLab: false,
      ownerDashboardLoaded: false,
      customerBookingCreated: false,
      stripeIntentAttempted: false,
      ownerMessageFeedVisible: false,
      ownerReportRendered: false,
    },
    screenshotsDir: outDir,
    screenshots,
  }

  const browser = await chromium.launch({ headless: false, slowMo: 150 })
  const guestContext = await browser.newContext({ viewport: { width: 1512, height: 960 } })
  const ownerContext = await browser.newContext({ viewport: { width: 1512, height: 960 } })
  const customerContext = await browser.newContext({ viewport: { width: 1512, height: 960 } })
  const guestPage = await guestContext.newPage()
  const ownerPage = await ownerContext.newPage()
  const customerPage = await customerContext.newPage()

  try {
    await guestPage.goto(`${baseUrl}/owner`, { waitUntil: 'networkidle' })
    manifest.assertions.guestRedirectToLogin = guestPage.url().includes('/login')
    await shot(guestPage, screenshots, '00-guest-owner-redirect')

    await signUp(ownerPage, { name: ownerName, email: ownerEmail, password })
    await ownerPage.goto(`${baseUrl}/owner`, { waitUntil: 'networkidle' })
    await ownerPage.waitForTimeout(5000)
    manifest.assertions.ownerDashboardLoaded = await ownerPage
      .getByText(/Business dashboard|Biz Owner Dashboard/i)
      .isVisible()
      .catch(() => false)
    await shot(ownerPage, screenshots, '01-owner-dashboard')

    await ownerPage.getByRole('button', { name: 'Services' }).click()
    await ownerPage.getByPlaceholder('Service name').fill(definition.serviceName)
    await ownerPage.getByRole('button', { name: 'Create service' }).click()

    await ownerPage.getByPlaceholder('Offer name').fill(definition.offerName)
    await ownerPage.getByPlaceholder('Default duration (minutes)').fill(String(definition.defaultDurationMin))
    if (definition.durationMode === 'variable') {
      const offerCard = ownerPage.locator('div.rounded-md.border.p-4').filter({ hasText: 'New offer' }).first()
      await selectOption(ownerPage, offerCard.getByRole('combobox').first(), /Variable duration/i)
    }
    await ownerPage.getByPlaceholder('Price (USD)').fill(String(Math.round(definition.priceMinor / 100)))
    await ownerPage.getByRole('button', { name: 'Create and publish offer' }).click()
    await ownerPage.waitForTimeout(1000)
    await shot(ownerPage, screenshots, '02-owner-services-offers')

    await ownerPage.locator('aside').getByRole('button', { name: 'Communications' }).click()
    await ownerPage.getByText('Message Activity').waitFor({ timeout: 15000 })
    manifest.assertions.ownerMessageFeedVisible = await ownerPage
      .getByText('Recent customer email and SMS delivery updates.')
      .isVisible()
      .catch(() => false)
    await shot(ownerPage, screenshots, '03-owner-communications')

    await ownerPage.locator('aside').getByRole('button', { name: 'Reports' }).click()
    await ownerPage.getByText('Business Reporting').waitFor({ timeout: 15000 })
    await ownerPage.getByRole('button', { name: 'Render report' }).click()
    await ownerPage.waitForTimeout(1200)
    manifest.assertions.ownerReportRendered = await ownerPage.getByText('Report rendered.').isVisible().catch(() => false)
    await shot(ownerPage, screenshots, '04-owner-reports')

    await ownerPage.locator('aside').getByRole('button', { name: 'Customers' }).click()
    await ownerPage.getByText('Business Visibility').waitFor({ timeout: 15000 })
    const visibilitySelect = ownerPage.getByRole('combobox').filter({ hasText: /Published|Private|Unpublished/i }).first()
    await selectOption(ownerPage, visibilitySelect, /^Published/i)
    await ownerPage.getByRole('button', { name: 'Save visibility' }).click()
    await ownerPage.waitForTimeout(800)
    await shot(ownerPage, screenshots, '05-owner-visibility-published')

    await signUp(customerPage, { name: customerName, email: customerEmail, password })
    await customerPage.goto(`${baseUrl}/book?search=${encodeURIComponent(ownerSeed)}`, { waitUntil: 'networkidle' })
    await customerPage.waitForTimeout(1500)

    const headerBizSelect = customerPage.getByRole('combobox').first()
    const ownerBizMatcher = new RegExp(escapeRegExp(ownerBizName), 'i')
    await selectOption(customerPage, headerBizSelect, ownerBizMatcher)
    const selectedBizLabel = (await headerBizSelect.textContent().catch(() => '')) ?? ''
    if (!ownerBizMatcher.test(selectedBizLabel)) {
      await headerBizSelect.click()
      await customerPage.keyboard.type(ownerBizName)
      await customerPage.keyboard.press('Enter')
      await customerPage.waitForTimeout(500)
    }
    await customerPage.waitForTimeout(1000)

    const locationSelect = customerPage.getByRole('combobox').nth(1)
    await selectOption(customerPage, locationSelect)
    const serviceSelect = customerPage.getByRole('combobox').nth(2)
    await selectOption(customerPage, serviceSelect, new RegExp(definition.offerName, 'i'))

    const dateInput = customerPage.locator('input[type="date"]').first()
    if (await dateInput.isVisible().catch(() => false)) {
      const minDate = await dateInput.getAttribute('min')
      if (minDate) await dateInput.fill(minDate)
    }
    await customerPage.waitForTimeout(700)
    const timeButton = customerPage.getByRole('button', { name: /\d{1,2}:\d{2}\s?(AM|PM|am|pm)/ }).first()
    if (await timeButton.isVisible().catch(() => false)) {
      await timeButton.click()
    }
    await shot(customerPage, screenshots, '06-customer-booking-surface')

    const confirmButton = customerPage.getByRole('button', { name: /Confirm booking|Reserve this time/i })
    if (await confirmButton.isEnabled().catch(() => false)) {
      await confirmButton.click()
      await customerPage.getByText(/Booking Summary|Review and pay/i).waitFor({ timeout: 15000 })
      manifest.assertions.customerBookingCreated = true
      await shot(customerPage, screenshots, '07-customer-booking-details')

      const payButton = customerPage.getByRole('button', { name: 'Pay with card' })
      if (await payButton.isVisible().catch(() => false)) {
        await payButton.click()
        manifest.assertions.stripeIntentAttempted = true
        await customerPage.waitForTimeout(1200)
      }
      await shot(customerPage, screenshots, '08-customer-payment')

      const continueButton = customerPage.getByRole('button', { name: /Continue to confirmation|View confirmation/i })
      if (await continueButton.isVisible().catch(() => false)) {
        await continueButton.click()
        await customerPage.getByText(/Your session is confirmed|Yay! Your booking is confirmed\./i).waitFor({ timeout: 10000 }).catch(() => null)
      }
      await shot(customerPage, screenshots, '09-customer-confirmation')
    } else {
      await shot(customerPage, screenshots, '07-customer-booking-not-ready')
    }

    await customerPage.goto(`${baseUrl}/dev/lab`, { waitUntil: 'networkidle' })
    manifest.assertions.customerBlockedFromDevLab = await customerPage
      .getByText('Insufficient role permissions')
      .isVisible()
      .catch(() => false)
    await shot(customerPage, screenshots, '10-customer-dev-lab-denied')

    await customerPage.waitForTimeout(Number.isFinite(holdMs) && holdMs > 0 ? holdMs : 1500)

    manifest.ok = Object.values(manifest.assertions).every(Boolean)
  } finally {
    manifest.finishedAt = new Date().toISOString()

    const localManifestPath = path.join(outDir, 'run-manifest.json')
    await writeFile(localManifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    const repoManifestPath = path.join(
      repoRunsDir,
      `${new Date().toISOString().replace(/[:.]/g, '-')}-uc${definition.ucId}.json`,
    )
    await writeFile(repoManifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    await guestContext.close()
    await ownerContext.close()
    await customerContext.close()
    await browser.close()

    console.log(
      JSON.stringify(
        {
          ok: manifest.ok,
          ucId: manifest.ucId,
          sagaKey: manifest.sagaKey,
          baseUrl: manifest.baseUrl,
          screenshotsDir: manifest.screenshotsDir,
          assertions: manifest.assertions,
        },
        null,
        2,
      ),
    )
  }
}

void run()
