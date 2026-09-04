import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const workspace = fileURLToPath(new URL('..', import.meta.url))
const testbed = process.env.NSV_TESTBED_PATH ?? resolve(workspace, '../Neurosignal-Testbed')
const temporary = mkdtempSync(join(tmpdir(), 'nsv-real-data-e2e-'))
const source = join(temporary, 'source_raw.fif')
const python = join(testbed, '.venv/bin/python')
execFileSync(python, ['-c', `
import sys, mne, numpy as np
times = np.arange(12000) / 200
data = np.array([np.sin(2 * np.pi * (8 + i) * times) for i in range(16)]) * 1e-5
raw = mne.io.RawArray(data, mne.create_info([f'EEG {i+1}' for i in range(16)], 200, 'eeg'), verbose=False)
raw.set_annotations(mne.Annotations([2, 20], [0, 1], ['Stimulus', 'BAD movement']))
raw.save(sys.argv[1], overwrite=False, verbose=False)
`, source], { cwd: testbed, stdio: 'pipe' })
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const before = hash(source)
const children = []
let browser

async function waitFor(url, child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Test server exited with ${child.exitCode}`)
    try { if ((await fetch(url)).ok) return } catch { /* Wait for startup. */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out starting ${url}`)
}

try {
  for (const url of ['http://127.0.0.1:8012/health', 'http://127.0.0.1:5174']) {
    try { await fetch(url); throw new Error(`Integration port already occupied: ${url}`) }
    catch (error) { if (error.message.startsWith('Integration port')) throw error }
  }
  const backend = spawn(python, ['-m', 'uvicorn', 'neurobridge_api.main:app', '--host', '127.0.0.1', '--port', '8012'], {
    cwd: testbed, env: { ...process.env, NEUROSIGNAL_PROJECTS_DIR: join(temporary, 'projects') }, stdio: 'pipe',
  })
  children.push(backend)
  const frontend = spawn(process.execPath, [join(testbed, 'apps/web/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5174'], {
    cwd: join(testbed, 'apps/web'), env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:8012' }, stdio: 'pipe',
  })
  children.push(frontend)
  for (const child of children) { child.stdout.resume(); child.stderr.on('data', (data) => process.stderr.write(data)) }
  await Promise.all([waitFor('http://127.0.0.1:8012/health', backend), waitFor('http://127.0.0.1:5174', frontend)])
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:5174')
  await page.getByRole('button', { name: /Real data/i }).first().click()
  await page.getByLabel('Local recording path').fill(source)
  await page.getByRole('button', { name: 'Inspect file', exact: true }).click()
  await page.getByText('INSPECTED', { exact: true }).waitFor()
  const imported = page.waitForResponse((response) => response.url().endsWith('/real-data/imports') && response.status() === 200)
  await page.getByRole('button', { name: 'Create local FIF copy', exact: true }).click()
  const result = await (await imported).json()
  const working = join(temporary, 'projects', result.project.project_id, 'recording_raw.fif')
  const workingHash = hash(working)
  await page.getByRole('img', { name: 'Imported FIF EEG traces' }).waitFor()
  const panel = page.getByRole('region', { name: 'Working-copy trace review' })
  await panel.scrollIntoViewIfNeeded()
  assert.equal(await panel.locator('.nsv-channel-select').count(), 8)
  const viewportResponse = page.waitForResponse((response) => response.url().includes('/trace-window?')
    && new URL(response.url()).searchParams.getAll('channels').includes('ch-8') && response.status() === 200)
  await panel.getByRole('button', { name: 'Next channel page' }).click()
  const window = await (await viewportResponse).json()
  assert.equal(Object.keys(window.channels).length, 8)
  assert(Object.values(window.channels).every((series) => (series.values ?? series.minimum).length <= 4800))
  await panel.getByRole('button', { name: 'EEG 9, EEG, V', exact: true }).waitFor()
  await panel.getByRole('slider', { name: /Recording overview/ }).focus()
  await page.keyboard.press('End')
  await page.waitForFunction(() => document.querySelector('.real-data-trace-panel .nsv-stage')?.getAttribute('aria-busy') === 'false')
  assert.equal(await panel.getByRole('slider', { name: 'Time position' }).inputValue(), '50')
  await page.screenshot({ path: join(temporary, 'real-data-review.png'), fullPage: true })
  assert.equal(hash(source), before)
  assert.equal(hash(working), workingHash)
  assert.deepEqual(errors, [])
  console.log(`Verified imported FIF browser workflow, channel paging, time navigation, source/working-copy hashes. Evidence: ${temporary}`)
} finally {
  await browser?.close()
  for (const child of children.reverse()) child.kill('SIGTERM')
}
