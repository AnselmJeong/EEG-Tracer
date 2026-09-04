# `@neurosignal/trace-viewer`

A backend-neutral React/TypeScript EEG trace viewer for NeuroSignal and other neural-signal tools.
It renders only the requested viewport, keeps source data immutable, preserves `NaN` gaps, and
supports locked-scale multi-layer comparisons through one component API.

This repository currently implements the Phase 0–1 package boundary from
[`TRACE_VIEWER_REPOSITORY_PLAN.md`](TRACE_VIEWER_REPOSITORY_PLAN.md). The package is private-first
and remains `0.x` until its interaction and long-recording phases are validated.

## Install from a local tarball

```bash
npm install
npm run build
npm pack --workspace @neurosignal/trace-viewer
```

Then install the emitted `neurosignal-trace-viewer-0.1.0.tgz` in a React consumer.

## NeuroSignal simulation adapter

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

## Public surface

- `TraceViewer`
- `createArrayTraceSource`
- Backend-neutral metadata, viewport, typed-array window, annotation, selection, and layer types
- Explicit CSS export: `@neurosignal/trace-viewer/styles.css`

The package does not import MNE, FastAPI, project IDs, file paths, authentication, or consumer state.
It never mutates source arrays and does not expose a trace-data export API.

## Verify

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check:pack
```

Run the playground with `npm run dev --workspace @neurosignal/trace-viewer-playground`.
