# Performance baseline

Phases 2–3 keep only a requested typed-array window in component state and never spread large
sample arrays to calculate extrema. Pointer-move feedback writes only transient overlay geometry;
React state and consumer callbacks update when the gesture commits. Annotation lanes use only the
current window; the overview uses metadata-only marker geometry and never copies signal samples.
The deterministic playground fixture is 8 channels × 12 seconds. Phase 4 will add browser benchmarks
for 64/128-channel Canvas windows, large marker sets, and cache budgets.
