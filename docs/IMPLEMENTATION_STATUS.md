# Implementation status

Updated: 2026-09-04

## Complete

- Phase 0 workspace, strict TypeScript, build, test, lint, CI, ADR, and package skeleton
- Backend-neutral `TraceDataSource` and immutable `createArrayTraceSource` adapter
- Point and peak-preserving min/max typed-array window representations
- Shared render model with high-DPI Canvas default and SVG compatibility renderer
- Multi-layer channel/unit/time compatibility checks and locked per-unit scaling
- `NaN` gap handling, annotations, bad-channel metadata, semantic channel summary, and status states
- Deterministic 8-channel × 12-second ICA before/after playground fixture
- Package dry-run and actual tarball installation in an isolated React 19 + Vite consumer
- Phase 2 controlled/uncontrolled viewport, cursor, segment, and channel-selection state
- Bounded time pan/zoom, per-channel-type gain, channel paging/count controls, and time scrollbar
- Scoped keyboard controls, wheel navigation, click cursor, drag selection, and Shift-drag pan
- Sample-snapped cursor/selection mapping, semantic cursor value readout, and static-mode fallback
- Reducer invariant coverage, component interaction tests, and Chromium pointer/keyboard E2E
- Phase 3 stacked annotation lanes, event markers, bad-segment patterns, and overlay filters
- Previous/next context jumps plus a full-duration pointer and keyboard overview navigator
- Explicit included-channel sets and capability/read-only-gated bad-channel intent controls
- Semantic annotation details and color-independent kind labels for both renderers

## Deliberately deferred

- Phase 4 annotation editing intents and request coordination
- Phase 4 request coordination, bounded cache, prefetch, channel virtualization, and benchmark gates
- Phase 5 real-data trace-window endpoint and Testbed application migration

The existing Neurosignal-Testbed working tree was not modified because its ICA viewer and related
files contain uncommitted work. The root README contains the direct adapter recipe for its current
`x`, `series`, and `channel_names` response contract. Application migration remains independently
reversible as required by the repository plan.
