import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const workspaceRoot = new URL('..', import.meta.url)
const temporaryRoot = mkdtempSync(join(tmpdir(), 'nsv-consumer-'))
const consumerRoot = join(temporaryRoot, 'consumer')
mkdirSync(join(consumerRoot, 'src'), { recursive: true })

const packed = JSON.parse(execFileSync(
  'npm',
  ['pack', '--workspace', '@neurosignal/trace-viewer', '--pack-destination', temporaryRoot, '--json'],
  { cwd: workspaceRoot, encoding: 'utf8' },
))
const filename = packed[0]?.filename
if (typeof filename !== 'string') throw new Error('The package tarball was not created.')
const tarball = join(temporaryRoot, filename)

writeFileSync(join(consumerRoot, 'package.json'), JSON.stringify({
  name: 'trace-viewer-tarball-consumer',
  private: true,
  version: '0.0.0',
  type: 'module',
  scripts: { build: 'tsc --noEmit && vite build' },
  dependencies: {
    '@neurosignal/trace-viewer': `file:${tarball}`,
    '@vitejs/plugin-react': '6.1.1',
    '@types/react': '19.2.18',
    '@types/react-dom': '19.2.5',
    'react': '19.2.8',
    'react-dom': '19.2.8',
    'typescript': '5.9.2',
    'vite': '8.2.2',
  },
}, null, 2))
writeFileSync(join(consumerRoot, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2022', lib: ['ES2022', 'DOM'], module: 'ESNext', moduleResolution: 'Bundler',
    jsx: 'react-jsx', strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true,
    noEmit: true, skipLibCheck: true,
  },
  include: ['src', 'vite.config.ts'],
}, null, 2))
writeFileSync(join(consumerRoot, 'vite.config.ts'), "import react from '@vitejs/plugin-react'\nimport { defineConfig } from 'vite'\nexport default defineConfig({ plugins: [react()] })\n")
writeFileSync(join(consumerRoot, 'index.html'), '<div id="root"></div><script type="module" src="/src/main.tsx"></script>')
writeFileSync(join(consumerRoot, 'src/main.tsx'), `
import { createRoot } from 'react-dom/client'
import { TraceViewer, createArrayTraceSource } from '@neurosignal/trace-viewer'
import '@neurosignal/trace-viewer/styles.css'

const source = createArrayTraceSource({
  sourceId: 'consumer-check',
  timesS: [0, 0.5, 1],
  series: { Fp1: [0, 4, 0], Fp2: [0, 2, 0] },
  annotations: [{ id: 'event', label: 'Stimulus', startTimeS: 0.5, durationS: 0, kind: 'event' }],
  capabilities: { canMarkBadChannels: true },
})
const root = document.getElementById('root')
if (!root) throw new Error('Missing root')
createRoot(root).render(
  <TraceViewer
    ariaLabel="Tarball consumer EEG"
    includedChannelIds={['Fp1']}
    layers={[{ id: 'eeg', label: 'EEG', source }]}
    onBadChannelIntent={(channelId, bad) => { console.info(channelId, bad) }}
    readOnly={false}
  />,
)
`)

execFileSync('npm', ['install', '--legacy-peer-deps', '--ignore-scripts', '--package-lock=false'], { cwd: consumerRoot, stdio: 'pipe' })
execFileSync('npm', ['run', 'build'], { cwd: consumerRoot, stdio: 'pipe' })
const output = readFileSync(join(consumerRoot, 'dist/index.html'), 'utf8')
if (!output.includes('/assets/')) throw new Error('Consumer build did not emit its application assets.')
console.log(`Verified actual tarball in a clean React 19 consumer: ${filename}.`)
