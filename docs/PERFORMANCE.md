# Performance baseline

Phase 4 baseline, 2026-09-05: Apple M2 Max, macOS 27.0, Playwright Chromium in headless mode.
Run `npm run test:browser`; the benchmark attaches `viewport-benchmark.json` to its test result.
This is the first reproducible high-channel baseline, not a before/after speedup claim.

| Scenario | Draw p95 | Accounted cache after 100 insertions | Entries |
| --- | ---: | ---: | ---: |
| 64 channels × 10 s × 1,200 envelope buckets | 2.9 ms | 29,497,536 bytes | 24 |
| 128 channels × 10 s × 1,200 envelope buckets | 5.9 ms | 58,988,736 bytes | 24 |

The benchmark uses the actual Canvas trace draw function, five warm-ups and twenty measured draws
at 1340×900. Measurements cover trace command submission, excluding browser compositing, metadata
loading, and network latency. The automated regression ceiling is 100 ms in either case; the plan's
22 ms target for 64 channels was met here. Interactive release-machine FPS/cursor latency remains
separate from this headless draw baseline.

The viewer cache has both a 64 MiB retained-buffer accounting limit and a 24-entry limit. Full
underlying buffers are counted, including oversized views; oversized entries are not retained.
This is cache accounting, not a claim about the browser's total JS heap or GPU memory. In-flight and
currently displayed windows also occupy memory. The real-data adapter bounds responses to 128
channels and 2,400 buckets (or twice as many points) per channel; the backend reduces bounded chunks.

`/?long` generates only requested samples from a deterministic one-hour/128-channel source. Browser
checks confirm 16 visible channel rows, channel paging, navigation to 3590 s, and identical SVG/Canvas
interaction geometry. Existing pointer and keyboard acceptance tests run alongside this benchmark.
Pointer-move feedback changes transient overlay DOM; cursor-only commits reuse the memoized Canvas.
Prefetch starts after 180 ms of settled navigation and stops while the document is hidden.
