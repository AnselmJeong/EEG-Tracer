import { useMemo, useState } from 'react'

import { TraceViewer, type TraceAnnotation, type TraceCursor, type TraceSelection, type TraceViewport } from '@neurosignal/trace-viewer'
import '@neurosignal/trace-viewer/styles.css'

import { DEFAULT_ANNOTATIONS, makeLayers } from './fixture'
import { makeLongRecording } from './long-recording'

interface Review { annotations?: readonly TraceAnnotation[]; badChannels?: Record<string, boolean>; revision: number }
const REVIEW_KEY = 'trace-viewer-playground-review-v1'

function loadReview(): Review {
  try {
    const value = localStorage.getItem(REVIEW_KEY)
    if (!value) return { revision: 0 }
    const review = JSON.parse(value) as Review
    if (!Number.isSafeInteger(review.revision) || review.revision < 0) return { revision: 0 }
    // The source factory validates annotation labels, IDs, times, and duplicate IDs.
    makeLayers(review)
    return review
  } catch { return { revision: 0 } }
}

export function App() {
  const long = new URLSearchParams(window.location.search).has('long')
  const [review, setReview] = useState(loadReview)
  const layers = useMemo(() => long ? [{ id: 'long', label: 'One-hour recording', source: makeLongRecording() }] : makeLayers(review), [long, review])
  const [viewport, setViewport] = useState<TraceViewport>({ startTimeS: 0, durationS: long ? 10 : 4, channelOffset: 0, visibleChannelCount: long ? 16 : 5, gainByType: {} })
  const [cursor, setCursor] = useState<TraceCursor | null>(null)
  const [selection, setSelection] = useState<TraceSelection | null>(null)
  const [selectedChannelIds, setSelectedChannelIds] = useState<readonly string[]>([])
  const [renderer, setRenderer] = useState<'canvas' | 'svg'>('canvas')
  const [intentNotice, setIntentNotice] = useState('Annotations are saved in this browser.')
  const saveReview = (next: Review, message: string) => {
    setReview(next)
    try {
      localStorage.setItem(REVIEW_KEY, JSON.stringify(next))
      setIntentNotice(message)
    } catch { setIntentNotice(`${message} Browser storage is unavailable; this change lasts until reload.`) }
  }

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
          viewport={viewport} onViewportChange={setViewport}
          cursor={cursor} onCursorChange={setCursor}
          selection={selection} onSelectionChange={setSelection}
          selectedChannelIds={selectedChannelIds} onSelectedChannelIdsChange={setSelectedChannelIds}
          layers={layers}
          onBadChannelIntent={(channelId, bad) => saveReview({ ...review, revision: review.revision + 1,
            badChannels: { ...review.badChannels, [channelId]: bad } }, `${channelId} marked ${bad ? 'bad' : 'good'}.`)}
          onAnnotationIntent={(intent) => {
            const annotations = review.annotations ?? DEFAULT_ANNOTATIONS
            const next = intent.type === 'create' ? [...annotations, { ...intent.annotation, id: crypto.randomUUID() }]
              : intent.type === 'update' ? annotations.map((annotation) => annotation.id === intent.annotation.id ? intent.annotation : annotation)
                : annotations.filter((annotation) => annotation.id !== intent.annotationId)
            saveReview({ ...review, annotations: next, revision: review.revision + 1 },
              intent.type === 'create' ? 'Annotation added.' : intent.type === 'update' ? 'Annotation saved.' : 'Annotation deleted.')
            if (intent.type === 'create') setSelection(null)
          }}
          readOnly={false}
          renderer={renderer}
        />
      </section>
      <footer>
        <span>{long ? '3600 s · 1000 Hz · 16-channel viewport' : '12.00 s · 100 Hz · 5-channel viewport'}</span>
        <p>Drag to select, right-click to annotate, and Shift-drag to pan. Dashed rust is generated input; solid teal is the cleaned derivative.</p>
        <p aria-live="polite">{long ? 'Long-recording preview is read-only.' : intentNotice}</p>
      </footer>
    </main>
  )
}
