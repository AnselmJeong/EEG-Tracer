import { execFileSync } from 'node:child_process'

const raw = execFileSync('npm', ['pack', '--workspace', '@neurosignal/trace-viewer', '--dry-run', '--json'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
})
const result = JSON.parse(raw)
if (!Array.isArray(result) || result.length !== 1) throw new Error('Expected one packed workspace.')
const files = new Set(result[0].files.map(({ path }) => path))
for (const required of ['dist/index.js', 'dist/index.d.ts', 'dist/trace-viewer.css', 'package.json']) {
  if (!files.has(required)) throw new Error(`Packed artifact is missing ${required}.`)
}
console.log(`Verified ${result[0].filename}: ${result[0].entryCount} files, ${result[0].unpackedSize} bytes unpacked.`)
