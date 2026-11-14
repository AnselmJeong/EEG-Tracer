# Changelog

## 0.4.2 — 2026-11-14

- Wheel input is handled by a native non-passive listener. React's passive `wheel` listener
  ignored `preventDefault()`, so the host page scrolled underneath the viewer while channels
  shifted. At the first or last channel the host now keeps the wheel so the page can scroll past.
  Channel paging follows accumulated wheel travel (one channel per 100 px) instead of one channel
  per event, which made trackpads race through the list.
- `layers` and `includedChannelIds` are compared by content. A host that rebuilds equal arrays on
  each render no longer reloads metadata and resets the viewport, and a label, color or line-style
  change updates in place.

## 0.4.1 — 2026-11-14

- Fixed runaway plot growth in content-sized hosts: the Canvas/SVG plot is now positioned out of
  flow, so the measured stage height can no longer feed back into itself. The stage keeps a 220 px
  minimum height.
- Envelope (min–max) traces are drawn as one connected polyline instead of isolated per-bucket
  strokes, which left gaps and dropped flat buckets entirely.

## 0.4.0 — 2026-09-05

- Completed Phase 4 cancellable viewport coordination, 64 MiB/24-entry LRU, idle adjacent prefetch,
  visibility cancellation, public `/testing` adapter harness, and 64/128-channel browser benchmarks.
- Kept previous-window coordinates during loading and memoized Canvas redraws across cursor changes.
- Added capability-gated annotation create/rename/delete intent controls.
- Corrected shared-unit scale readouts and sub-millivolt cursor/scale formatting for SI-valued data.
- Added the Phase 5 Testbed adapter, working-copy-only FIF endpoints, and real browser import checks
  in the sibling Neurosignal-Testbed repository. No runtime MNE or HTTP dependency enters the package.

## 0.3.0 — 2026-09-04

- Added stacked annotation lanes, point-event markers, bad-segment patterns, and display filters.
- Added previous/next marker jumps and a keyboard-accessible full-recording overview.
- Added explicit included-channel sets and semantic context details for Canvas and SVG views.
- Added capability- and read-only-gated bad-channel intents without internal source mutation.
- Added overlap, boundary, hidden-label, keyboard, capability, and Chromium review-flow coverage.

## 0.2.0 — 2026-09-04

- Added controlled and uncontrolled viewport, cursor, segment selection, and channel-selection state.
- Added time pan/zoom, per-type amplitude gain, channel paging, and visible-channel controls.
- Added pointer, wheel, keyboard, sample snapping, boundary clamping, and a Phase 1 static fallback.
- Added reducer property coverage and real Chromium interaction tests.

## 0.1.0 — 2026-09-04

- Added the backend-neutral trace data contract and in-memory adapter.
- Added SVG and Canvas renderers with shared-scale multi-layer comparison.
- Added a deterministic NeuroSignal ICA fixture and standalone playground.
- Added package, accessibility, and consumer-build verification.
