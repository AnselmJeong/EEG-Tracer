import { useMemo, useState } from 'react'

import { TraceViewer } from '@neurosignal/trace-viewer'
import '@neurosignal/trace-viewer/styles.css'

import { makeLayers } from './fixture'
import { makeLongRecording } from './long-recording'

export function App() {
  const long = new URLSearchParams(window.location.search).has('long')
  const layers = useMemo(() => long ? [{ id: 'long', label: 'One-hour recording', source: makeLongRecording() }] : makeLayers(), [long])
  const [renderer, setRenderer] = useState<'canvas' | 'svg'>('canvas')
  const [intentNotice, setIntentNotice] = useState('No review intent emitted.')

  return (
    <main>
      <header>
        <div>
          <span>NEUROSIGNAL · DISPLAY CONTRACT 0.4</span>
          <h1>Trace Viewer</h1>
          <p>{long ? '128 channels · one hour · viewport data generated on demand.' : 'Eight channels. One locked scale. Source arrays remain untouched.'}</p>
          <a href={long ? '/' : '/?long'}>{long ? 'Open ICA comparison' : 'Open 128-channel recording'}</a>
        </div>
        <div aria-label="Renderer" className="renderer-switch" role="group">
          {(['canvas', 'svg'] as const).map((option) => (
            <button aria-pressed={renderer === option} key={option} onClick={() => setRenderer(option)}>{option}</button>
          ))}
        </div>
      </header>
      <section className="viewer-frame">
        <TraceViewer
          ariaLabel={long ? '128-channel long EEG recording' : 'Eight-channel EEG before and after ICA repair'}
          defaultViewport={{ durationS: long ? 10 : 4, visibleChannelCount: long ? 16 : 5 }}
          layers={layers}
          onBadChannelIntent={(channelId, bad) => setIntentNotice(`Requested ${bad ? 'bad' : 'good'} status for ${channelId}; source metadata is unchanged.`)}
          onAnnotationIntent={(intent) => setIntentNotice(`Requested annotation ${intent.type}; awaiting data-owner confirmation.`)}
          readOnly={false}
          renderer={renderer}
        />
      </section>
      <footer>
        <span>{long ? '3600 s · 1000 Hz · 16-channel viewport' : '12.00 s · 100 Hz · 5-channel viewport'}</span>
        <p>Drag to select, click for a cursor, and Shift-drag to pan. Dashed rust is generated input; solid teal is the cleaned derivative.</p>
        <p aria-live="polite">{intentNotice}</p>
      </footer>
    </main>
  )
}
