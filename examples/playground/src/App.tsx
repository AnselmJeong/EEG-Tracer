import { useMemo, useState } from 'react'

import { TraceViewer } from '@neurosignal/trace-viewer'
import '@neurosignal/trace-viewer/styles.css'

import { makeLayers } from './fixture'

export function App() {
  const layers = useMemo(makeLayers, [])
  const [renderer, setRenderer] = useState<'canvas' | 'svg'>('canvas')
  const [intentNotice, setIntentNotice] = useState('No review intent emitted.')

  return (
    <main>
      <header>
        <div>
          <span>NEUROSIGNAL · DISPLAY CONTRACT 0.3</span>
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
          defaultViewport={{ durationS: 4, visibleChannelCount: 5 }}
          layers={layers}
          onBadChannelIntent={(channelId, bad) => setIntentNotice(`Requested ${bad ? 'bad' : 'good'} status for ${channelId}; source metadata is unchanged.`)}
          readOnly={false}
          renderer={renderer}
        />
      </section>
      <footer>
        <span>12.00 s · 100 Hz · 5-channel viewport</span>
        <p>Drag to select, click for a cursor, and Shift-drag to pan. Dashed rust is generated input; solid teal is the cleaned derivative.</p>
        <p aria-live="polite">{intentNotice}</p>
      </footer>
    </main>
  )
}
