# Implementation status

Updated: 2026-09-05 · package 0.4.1

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

- Phase 4 per-layer foreground/background request coordination with abort and stale-response rejection
- Viewer-local revision/representation-aware LRU: 64 MiB retained-buffer accounting and 24 entries
- Settled-navigation adjacent prefetch; cancellation on navigation, unmount, or tab hiding
- Public `@neurosignal/trace-viewer/testing` acceptance harness and response validator
- Lazy one-hour/128-channel playground with visible-channel-only DOM and requests
- 64/128-channel Canvas benchmark, cache ceiling, peak oracle, race, and renderer mapping checks
- Capability-gated annotation creation, rename, and deletion requests with native keyboard controls
- Phase 5 sibling Testbed working-copy FIF metadata/window endpoints and typed HTTP adapter
- Imported-file browser review panel, refresh recovery, SI unit display, and original/working-copy hash checks
- MNE point/envelope oracle, chunked reads, revision conflicts, API, adapter, and import-to-viewer browser checks

## Next phase

- Phase 6 grouping, richer overview/time formats, butterfly display, and stable-release API/accessibility review
- Simulation ICA component migration remains separately reversible and has not been bundled into the
  real-data integration; the existing Testbed ICA implementation is retained.

Phase 5 code lives in `../Neurosignal-Testbed`. Its worktree was clean when this session began.
See [REAL_DATA_INTEGRATION.md](REAL_DATA_INTEGRATION.md) for transport limits, test commands, and rollback.

## Verified handoff (2026-09-05)

- Viewer: 32 unit/component tests; 5 Chromium interaction/benchmark tests
- Testbed: 13 web tests; 16 selected API/real-data/FIF oracle tests
- Real import → Canvas review → channel/time navigation browser workflow using temporary FIF data
- Original, working-copy, and manifest SHA-256 preservation in oracle tests; original/working-copy
  SHA-256 preservation through browser navigation
- Both TypeScript builds, package lint, Python changed-file Ruff checks, package dry-run,
  isolated React 19 tarball consumer build, and both repositories' `git diff --check`
- Testbed uses the portable 0.4.1 tarball with a single deduplicated React runtime

No registry publication or remote push was performed. Changes are present in both local worktrees.
