import { useMemo, useState } from 'react'

import { TraceViewer } from '@neurosignal/trace-viewer'
import '@neurosignal/trace-viewer/styles.css'

import { makeLayers } from './fixture'

export function App() {
  const layers = useMemo(makeLayers, [])
  const [renderer, setRenderer] = useState<'canvas' | 'svg'>('canvas')

  return (
    <main>
      <header>
        <div>
          <span>NEUROSIGNAL · DISPLAY CONTRACT 0.1</span>
          <h1>Trace Viewer</h1>
          <p>Eight channels. One locked scale. Source arrays remain untouched.</p>
        </div>
        <div aria-label="Renderer" className="renderer-switch" role="group">
          {(['canvas', 'svg'] as const).map((option) => (
            <button aria-pressed={renderer === option} key={option} onClick={() => setRenderer(option)}>{option}</button>
          ))}
        </div>
      </header>
      <section className="viewer-frame">
        <TraceViewer
          ariaLabel="Eight-channel EEG before and after ICA repair"
          layers={layers}
          renderer={renderer}
        />
      </section>
      <footer>
        <span>12.00 s · 100 Hz · µV</span>
        <p>Dashed rust is generated input. Solid teal is the cleaned derivative. “BAD” is display metadata, not an automated decision.</p>
      </footer>
    </main>
  )
}
