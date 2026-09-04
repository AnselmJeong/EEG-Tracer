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

## Deliberately deferred

- Phase 2 navigation, zoom, gain controls, cursor, and segment selection
- Phase 3 annotation editing and bad-channel intent controls
- Phase 4 request coordination, bounded cache, prefetch, channel virtualization, and benchmark gates
- Phase 5 real-data trace-window endpoint and Testbed application migration

The existing Neurosignal-Testbed working tree was not modified because its ICA viewer and related
files contain uncommitted work. The root README contains the direct adapter recipe for its current
`x`, `series`, and `channel_names` response contract. Application migration remains independently
reversible as required by the repository plan.
