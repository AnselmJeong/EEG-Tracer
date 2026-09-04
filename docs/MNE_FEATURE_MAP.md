# MNE feature map

The package independently implements the display concepts documented in the repository plan; it
does not port MNE-Python source. Phase 2 covers bounded navigation and zoom, per-type display gain,
channel viewport paging and selection, explicit channel sets, a linked cursor, and sample-snapped
segment selection. Phase 3 adds read-only-first annotation/event/bad-segment overlays, filters,
marker jumps, a full-duration overview, and capability-gated bad-channel intent. Annotation editing,
peak-preserving remote windows, virtualization, and advanced grouping remain gated by later phases.
