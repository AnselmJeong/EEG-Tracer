# Performance baseline

Phase 1 keeps only a requested typed-array window in component state and never spreads large
sample arrays to calculate extrema. The deterministic playground fixture is 8 channels × 12
seconds. Phase 4 will add browser benchmarks for 64/128-channel Canvas windows and cache budgets.
