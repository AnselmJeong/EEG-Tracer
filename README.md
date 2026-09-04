# `@neurosignal/trace-viewer`

A backend-neutral React/TypeScript EEG trace viewer for NeuroSignal and other neural-signal tools.
It renders only the requested viewport, keeps source data immutable, preserves `NaN` gaps, and
supports locked-scale multi-layer comparisons through one component API.

This repository implements Phases 0–4 and the Phase 5 Testbed integration from
[`TRACE_VIEWER_REPOSITORY_PLAN.md`](TRACE_VIEWER_REPOSITORY_PLAN.md). The package is private-first
and remains `0.x` while the Phase 6 release/API review is pending.

## Install from a local tarball

```bash
npm install
npm run build
npm pack --workspace @neurosignal/trace-viewer
```

Then install the emitted `neurosignal-trace-viewer-0.4.0.tgz` in a React consumer.

## NeuroSignal simulation adapter

For long-recording and imported FIF use, see [Phase 5 integration](docs/REAL_DATA_INTEGRATION.md).
The playground's **Open 128-channel recording** link exercises one-hour, viewport-only loading.
Performance evidence is recorded in [PERFORMANCE.md](docs/PERFORMANCE.md).

The current Neurosignal-Testbed response can be used without changing its API shape:

```tsx
import { useMemo } from 'react'
import {
  TraceViewer,
  createArrayTraceSource,
  type TraceChannel,
} from '@neurosignal/trace-viewer'
import '@neurosignal/trace-viewer/styles.css'

function SensorTrace({ x, series, channelNames }: {
  x: number[]
  series: Record<string, number[]>
  channelNames: string[]
}) {
  const source = useMemo(() => createArrayTraceSource({
    sourceId: 'ica-simulation',
    revision: 'simulation-response-v1',
    title: 'Simulated EEG',
    timesS: x,
    series,
    channels: channelNames.map((label): TraceChannel => ({
      id: label,
      label,
      type: 'eeg',
      unit: 'µV',
      bad: false,
    })),
  }), [channelNames, series, x])

  return (
    <TraceViewer
      ariaLabel="Eight-channel simulated contaminated EEG browser"
      layers={[{ id: 'sensor', label: 'Generated EEG', source }]}
      renderer="svg"
    />
  )
}
```

For before/after ICA, create two sources with the same channel IDs and times, then pass two layers.
The viewer validates source revision, channel identity, units, sampling rate, and time coordinates
before drawing them on one locked scale.

## Phase 2 interaction

Navigation state may be uncontrolled through `defaultViewport` or controlled through `viewport`.
Cursor, segment selection, and selected channel IDs follow the same pattern. Every callback returns
a new intent value; the viewer never mutates source arrays or consumer state.

```tsx
<TraceViewer
  ariaLabel="Interactive EEG review"
  layers={layers}
  defaultViewport={{ durationS: 10, visibleChannelCount: 20 }}
  defaultCursor={{ timeS: 0 }}
  defaultSelectedChannelIds={['Fp1']}
  onViewportChange={setViewport}
  onCursorChange={setCursor}
  onSelectionChange={setSelection}
  onSelectedChannelIdsChange={setSelectedChannelIds}
/>
```

- Toolbar buttons and the time slider pan, zoom, scale amplitude, and page channels.
- Click sets a sample-snapped cursor; drag creates a bounded segment; Shift-drag pans.
- Horizontal wheel/trackpad input pans, vertical wheel input pages channels, and Alt-wheel zooms.
- The focused plot supports arrows, Page Up/Down, Home/End, gain with plus/minus, time zoom with
  Alt plus/minus, Enter channel selection, and Escape selection clearing.
- Set `interactive={false}` to retain the Phase 1 static renderer as a rollback path.

## Phase 3 review context

Annotations, point events, and bad segments have distinct text/pattern treatments in a stacked lane
and the full-recording overview. Their toolbar toggles filter display context without changing the
source. Marker buttons, previous/next controls, overview clicks, and overview keyboard navigation
jump the viewport and linked cursor together.

`readOnly` defaults to `true`. A bad-channel control is exposed only when the viewer is explicitly
made writable, the source advertises `canMarkBadChannels`, and a callback is provided. Clicking it
emits a request but does not alter metadata; the consumer must confirm, persist a derivative/project
state, and return a new source revision.

```tsx
const source = createArrayTraceSource({
  sourceId: 'review',
  timesS,
  series,
  annotations,
  capabilities: { canMarkBadChannels: true },
})

<TraceViewer
  ariaLabel="EEG review"
  includedChannelIds={['Fp1', 'Fp2', 'C3']}
  layers={[{ id: 'signal', label: 'Signal', source }]}
  onBadChannelIntent={(channelId, bad) => requestReviewChange({ channelId, bad })}
  readOnly={false}
/>
```

## Public surface

- `TraceViewer`
- `createArrayTraceSource`
- Backend-neutral metadata, viewport, typed-array window, annotation, selection, and layer types
- Explicit CSS export: `@neurosignal/trace-viewer/styles.css`
- Controlled/uncontrolled viewport, cursor, segment selection, and channel-selection callbacks
- Explicit included-channel set, annotation/event filters and jump navigation, recording overview,
  capability-gated bad-channel intent callback

The package does not import MNE, FastAPI, project IDs, file paths, authentication, or consumer state.
It never mutates source arrays and does not expose a trace-data export API.

## Verify

```bash
npm run typecheck
npm run lint
npm test
npm run test:browser
npm run build
npm run check:pack
```

Run the playground with `npm run dev --workspace @neurosignal/trace-viewer-playground`.
