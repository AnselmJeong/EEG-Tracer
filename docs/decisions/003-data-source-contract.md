# ADR 003: Viewport data-source contract

Status: accepted · 2026-09-04

Sources expose immutable metadata and cancellable viewport windows. Windows contain typed arrays
as either points or peak-preserving min/max buckets. `sourceId` and `revision` are checked on every
response. Transport details and source-file locations remain outside the package.
