# `@neurosignal/trace-viewer`

A backend-neutral React EEG trace viewer with Canvas and SVG renderers, locked-scale comparisons,
bounded navigation, review-context overlays, cursor inspection, and safe mutation intents.

```tsx
import { TraceViewer, createArrayTraceSource } from '@neurosignal/trace-viewer'
import '@neurosignal/trace-viewer/styles.css'

const source = createArrayTraceSource({
  sourceId: 'example',
  timesS: [0, 0.5, 1],
  series: { Fp1: [0, 4, 0] },
  annotations: [{ id: 'event-1', label: 'Stimulus', startTimeS: 0.5, durationS: 0, kind: 'event' }],
  capabilities: { canMarkBadChannels: true },
})

<TraceViewer
  ariaLabel="Interactive EEG"
  defaultViewport={{ durationS: 1, visibleChannelCount: 1 }}
  layers={[{ id: 'signal', label: 'Signal', source }]}
  onBadChannelIntent={(channelId, bad) => requestReviewChange({ channelId, bad })}
  readOnly={false}
/>
```

The package never mutates source data. Navigation and selection are controlled or uncontrolled.
Annotation filters are display-only, and capability-gated bad-channel controls only emit intent for
the consumer to confirm and persist.

Version 0.4 uses a viewer-local LRU (64 MiB retained-buffer budget, 24 entries), cancels superseded
requests, rejects malformed/stale responses, and prefetches adjacent windows after navigation settles.
Hidden tabs stop prefetch. Both renderers request and display only visible channels. During a pending
request, the previous trace retains its own time/channel coordinates and the stage reports busy.
Array sources remain a small-recording convenience; remote adapters should bound samples by pixel width.

Consumer adapters can run the public transport-neutral harness:

```ts
import { checkTraceDataSource, validateTraceWindow } from '@neurosignal/trace-viewer/testing'
await checkTraceDataSource(source, [request])
```

The harness checks typed arrays, source/revision identity, channel selection, envelope bounds,
time coordinates, and already-aborted requests. `validateTraceWindow(source.id, request, window)`
can also validate individual responses after decoding transport data.

`onAnnotationIntent` enables native keyboard-accessible create-from-selection/cursor, rename, and
delete request controls when `readOnly={false}` and every visible layer advertises
`canEditAnnotations`. The consumer confirms/persists changes and refreshes source metadata with
a new revision; intent emission never changes displayed source annotations on its own.
