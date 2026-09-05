import { expect, test } from '@playwright/test'

test('navigates, zooms, pages channels, and retains keyboard focus', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('img', { name: 'Eight-channel EEG before and after ICA repair' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Time position' })).toHaveValue('0')

  const surface = page.getByRole('application', { name: 'Interactive trace viewport' })
  await surface.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('slider', { name: 'Time position' })).toHaveValue('0.4')
  await expect(surface).toBeFocused()

  await page.keyboard.press('Alt++')
  await expect(page.getByText('2.00 s', { exact: true })).toBeVisible()
  await expect(surface).toBeFocused()

  await page.getByRole('button', { name: 'Next channel page' }).click()
  await expect(page.getByRole('button', { name: /O2, EEG, µV/ })).toBeVisible()
  await expect(page.getByText('4–8 / 8', { exact: true })).toBeVisible()
})

test('maps a pointer drag to a bounded time selection', async ({ page }) => {
  await page.goto('/')
  const surface = page.getByRole('application', { name: 'Interactive trace viewport' })
  const bounds = await surface.boundingBox()
  expect(bounds).not.toBeNull()
  if (bounds === null) return

  await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * 0.25, bounds.y + bounds.height * 0.5, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByText(/Selection 1\.000–3\.000 s · 2\.000 s/)).toBeVisible()
})

test('jumps through context markers and saves bad-channel changes locally', async ({ page }) => {
  await page.goto('/')
  const eventMarker = page.getByRole('button', { name: /Jump to event Planted blink peak/ })
  await expect(eventMarker).toBeVisible()
  await eventMarker.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('slider', { name: 'Time position' })).toHaveValue('3.25')
  await expect(page.getByRole('button', { name: /Jump to BAD: Movement contamination/ })).toBeVisible()

  const intent = page.getByRole('button', { name: 'Mark Fp1 as bad' })
  await intent.click()
  await expect(page.getByText('Fp1 marked bad.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fp1, EEG, µV, bad channel' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Restore Fp1 as good' })).toBeVisible()

  await page.getByRole('button', { name: 'Show event overlays' }).click()
  await expect(eventMarker).toHaveCount(0)

  const overview = page.getByRole('slider', { name: /Recording overview, visible window/ })
  await overview.focus()
  await page.keyboard.press('End')
  await expect(page.getByRole('slider', { name: 'Time position' })).toHaveValue('8')
  await expect(overview).toBeFocused()
})
