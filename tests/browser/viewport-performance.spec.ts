import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import type * as FixtureModule from '../../examples/playground/src/long-recording'
import type * as CanvasModule from '../../packages/trace-viewer/src/renderers/CanvasTraceRenderer'
import type * as ModelModule from '../../packages/trace-viewer/src/renderers/TraceRenderer'
import type * as CacheModule from '../../packages/trace-viewer/src/data-source/viewport-cache'

test('virtualizes 128 channels and navigates a one-hour source in Canvas and SVG', async ({ page }) => {
  await page.goto('/?long')
  await expect(page.getByRole('img', { name: '128-channel long EEG recording' })).toBeVisible()
  await expect(page.locator('.nsv-channel-select')).toHaveCount(16)
  await page.getByRole('button', { name: 'Next channel page' }).click()
  await expect(page.getByRole('button', { name: 'EEG 17, EEG, µV' })).toBeVisible()
  await expect(page.locator('.nsv-channel-select')).toHaveCount(16)
  const overview = page.getByRole('slider', { name: /Recording overview/ })
  await overview.focus()
  await page.keyboard.press('End')
  await expect(page.getByRole('slider', { name: 'Time position' })).toHaveValue('3590')
  await expect(page.locator('.nsv-stage')).toHaveAttribute('aria-busy', 'false')
  const canvasBounds = await page.locator('.nsv-interaction-overlay').boundingBox()
  await page.getByRole('button', { name: 'svg', exact: true }).click()
  await expect(page.locator('svg.nsv-plot')).toBeVisible()
  const svgBounds = await page.locator('.nsv-interaction-overlay').boundingBox()
  expect(svgBounds).toEqual(canvasBounds)
  await expect(page.locator('[data-layer="long"]')).toHaveCount(16)
})

test('records reproducible 64/128-channel Canvas draw and cache baselines', async ({ page }, testInfo) => {
  await page.goto('/?long')
  const results = await page.evaluate(async (rendererPath) => {
    // Vite serves these exact modules from the local test workspace.
    const fixturePath = '/src/long-recording.ts'
    const modelPath = rendererPath.replace('CanvasTraceRenderer.tsx', 'TraceRenderer.ts')
    const cachePath = rendererPath.replace('renderers/CanvasTraceRenderer.tsx', 'data-source/viewport-cache.ts')
    const { makeLongRecording } = await import(fixturePath) as typeof FixtureModule
    const { drawSeries } = await import(rendererPath) as typeof CanvasModule
    const { createRenderModel } = await import(modelPath) as typeof ModelModule
    const { ViewportCache } = await import(cachePath) as typeof CacheModule
    const result = []
    for (const count of [64, 128]) {
      const source = makeLongRecording(count)
      const metadata = await source.getMetadata()
      const viewport = { startTimeS: 0, durationS: 10, channelOffset: 0, visibleChannelCount: count, gainByType: {} }
      const window = await source.getWindow({ sourceRevision: '1', startTimeS: 0, durationS: 10,
        channelIds: metadata.channels.map((channel: { id: string }) => channel.id), pixelWidth: 1200, preferredRepresentation: 'min-max' })
      const model = createRenderModel({ ariaLabel: 'benchmark', width: 1340, height: 900,
        viewport, layers: [{ metadata, window, layer: { id: 'bench', label: 'bench', source } }] })
      const canvas = document.createElement('canvas')
      canvas.width = 1340; canvas.height = 900
      const context = canvas.getContext('2d')!
      const draws = []
      for (let run = 0; run < 25; run += 1) {
        const started = performance.now()
        context.clearRect(0, 0, 1340, 900)
        model.channels.forEach((channel, index) => drawSeries(context, window.channels.get(channel.id)!, index, channel.id, model))
        if (run >= 5) draws.push(performance.now() - started)
      }
      draws.sort((a, b) => a - b)
      const cache = new ViewportCache()
      for (let i = 0; i < 100; i += 1) cache.set(String(i), window)
      result.push({ channels: count, drawP95Ms: draws[Math.ceil(draws.length * 0.95) - 1]!, cache: cache.stats })
    }
    return result
  }, `/@fs${fileURLToPath(new URL('../../packages/trace-viewer/src/renderers/CanvasTraceRenderer.tsx', import.meta.url))}`)
  console.log(JSON.stringify(results))
  await testInfo.attach('viewport-benchmark.json', { body: JSON.stringify(results, null, 2), contentType: 'application/json' })
  for (const result of results) {
    expect(result.cache.bytes).toBeLessThanOrEqual(64 * 1024 * 1024)
    expect(result.cache.entries).toBeLessThanOrEqual(24)
    // Generous CI regression ceiling; target-Mac measurements remain separately reported.
    expect(result.drawP95Ms).toBeLessThan(100)
  }
})
