# ADR 002: Canvas-first rendering with SVG compatibility

Status: accepted · 2026-09-04

Canvas is the default renderer for scalable trace drawing. SVG remains available for the existing
NeuroSignal eight-channel characterization fixture and semantic/visual regression tests. Both use
the same render model so time, row, unit, gap, and locked-gain calculations cannot drift silently.
