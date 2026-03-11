import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium, type Page } from '@playwright/test'

const baseUrl = process.env.ADMIN_BASE_URL ?? 'http://localhost:9000'
const stamp = Date.now().toString(36)
const ownerName = 'Sarah Owner'
const customerName = 'Noah Customer'
const password = 'Passw0rd!234'
const holdMs = Number(process.env.HOLD_MS ?? '2500')
const ownerEmail = `sarah.uc1.${stamp}@example.com`
const customerEmail = `customer.uc1.${stamp}@example.com`
const outDir = path.resolve('/tmp', `uc1-browser-${stamp}`)

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true })
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
  await page.getByRole('button', { name: 'Create account' }).click()
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }),
    page.getByRole('button', { name: 'Create account' }).waitFor({ state: 'visible', timeout: 15000 }),
  ]).catch(() => null)
  await page.waitForLoadState('networkidle')
}

async function selectFirstOptionFromCombobox(
  page: Page,
  combobox: ReturnType<Page['getByRole']>,
  fallbackLabel?: string,
) {
  const visible = await combobox.isVisible().catch(() => false)
  if (!visible) return false

  await combobox.click()
  if (fallbackLabel) {
    const preferred = page.getByRole('option', { name: new RegExp(fallbackLabel, 'i') }).first()
    if (await preferred.isVisible().catch(() => false)) {
      await preferred.click()
      return true
    }
  }
  await page.getByRole('option').first().click()
  return true
}

async function run() {
  await mkdir(outDir, { recursive: true })

  const browser = await chromium.launch({
    headless: false,
    slowMo: 220,
  })

  const ownerContext = await browser.newContext({ viewport: { width: 1512, height: 960 } })
  const customerContext = await browser.newContext({ viewport: { width: 1512, height: 960 } })
  const ownerPage = await ownerContext.newPage()
  const customerPage = await customerContext.newPage()

  try {
    await signUp(ownerPage, { name: ownerName, email: ownerEmail, password })
    await ownerPage.goto(`${baseUrl}/owner`, { waitUntil: 'networkidle' })
    await ownerPage.waitForTimeout(4500)
    await shot(ownerPage, '01-owner-dashboard-initial')

    await signUp(customerPage, { name: customerName, email: customerEmail, password })
    await shot(customerPage, '02-customer-account-created')

    await ownerPage.getByRole('button', { name: 'Services' }).click()
    await shot(ownerPage, '03-owner-services-and-offers')

    await customerPage.goto(`${baseUrl}/book`, { waitUntil: 'networkidle' })
    await customerPage.waitForTimeout(1600)

    const bizCombobox = customerPage.getByRole('combobox').first()
    await selectFirstOptionFromCombobox(customerPage, bizCombobox, "Sarah's Studio")
    await customerPage.waitForTimeout(700)

    let offerCombobox = customerPage.getByRole('combobox').nth(1)
    if (!(await offerCombobox.isVisible().catch(() => false))) {
      offerCombobox = customerPage.getByRole('combobox').first()
    }
    const pickedOffer = await selectFirstOptionFromCombobox(customerPage, offerCombobox, 'Consultation')
    await customerPage.waitForTimeout(1200)

    if (pickedOffer) {
      const dateInput = customerPage.locator('input[type="date"]').first()
      if (await dateInput.isVisible().catch(() => false)) {
        const minDate = await dateInput.getAttribute('min')
        if (minDate) await dateInput.fill(minDate)
        await customerPage.waitForTimeout(400)
      }

      const timeButton = customerPage.getByRole('button', { name: /\d{1,2}:\d{2}\s?(AM|PM|am|pm)/ }).first()
      if (await timeButton.isVisible().catch(() => false)) {
        await timeButton.click()
      }
    }

    await shot(customerPage, '04-customer-booking-surface')

    const confirmButton = customerPage.getByRole('button', { name: 'Confirm booking' })
    const confirmVisible = await confirmButton.isVisible().catch(() => false)
    const confirmEnabled = await confirmButton.isEnabled().catch(() => false)
    if (confirmVisible && confirmEnabled) {
      await confirmButton.click()
      await customerPage.getByText('Booking Summary').waitFor({ timeout: 15000 })
      await shot(customerPage, '05-customer-booking-details')

      const payButton = customerPage.getByRole('button', { name: 'Pay with card' })
      if (await payButton.isVisible().catch(() => false)) {
        await payButton.click()
        await customerPage.waitForTimeout(1200)
      }
      await shot(customerPage, '06-customer-payment-attempt')

      await customerPage.getByRole('button', { name: 'Continue to confirmation' }).click()
      await customerPage.getByText('Your session is confirmed').waitFor({ timeout: 15000 })
      await shot(customerPage, '07-customer-confirmation')
    } else {
      await shot(customerPage, '05-customer-booking-not-ready')
    }

    await customerPage.waitForTimeout(Number.isFinite(holdMs) && holdMs > 0 ? holdMs : 2500)
  } finally {
    await ownerContext.close()
    await customerContext.close()
    await browser.close()
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        owner: { name: ownerName, email: ownerEmail },
        customer: { name: customerName, email: customerEmail },
        screenshotsDir: outDir,
      },
      null,
      2,
    ),
  )
}

void run()
