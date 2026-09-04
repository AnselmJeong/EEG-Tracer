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
