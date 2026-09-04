# ADR 001: Independent package boundary

Status: accepted · 2026-09-04

The viewer is a React peer-dependency package with no NeuroSignal, backend, file-format, or MNE
runtime imports. Consumers own acquisition, persistence, provenance, and scientific transforms.
The package accepts a `TraceDataSource` and returns user intent through callbacks.
